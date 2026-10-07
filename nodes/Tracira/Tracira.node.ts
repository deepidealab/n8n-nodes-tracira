import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	IN8nHttpFullResponse,
	INode,
	INodeExecutionData,
	INodeProperties,
	INodeType,
	INodeTypeDescription,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import { getProjects } from './listSearch/getProjects';
import { getTasks } from './listSearch/getTasks';

const baseUrl = 'https://www.tracira.com/api';

const logResourceDisplay = {
	resource: ['log'],
};

const apiDisplay = {
	resource: ['api'],
};

const logOperationDisplay = {
	resource: ['log'],
	operation: ['log'],
};

const getDisplay = {
	resource: ['log'],
	operation: ['get'],
};

const getAllDisplay = {
	resource: ['log'],
	operation: ['search'],
};

const setDecisionDisplay = {
	resource: ['log'],
	operation: ['setDecision'],
};

const flagDisplay = {
	resource: ['log'],
	operation: ['flag'],
};

const updateDisplay = {
	resource: ['log'],
	operation: ['update'],
};

const uploadDisplay = {
	resource: ['log'],
	operation: ['upload'],
};

const downloadDisplay = {
	resource: ['log'],
	operation: ['download'],
};

const apiCallDisplay = {
	resource: ['api'],
	operation: ['call'],
};

const instructionsResourceDisplay = {
	resource: ['instructions'],
};

const instructionsGetDisplay = {
	resource: ['instructions'],
	operation: ['getInstructions'],
};

const instructionsUpdateDisplay = {
	resource: ['instructions'],
	operation: ['updateInstructions'],
};

const instructionsQueueDisplay = {
	resource: ['instructions'],
	operation: ['queueFeedback'],
};

const instructionsWithdrawDisplay = {
	resource: ['instructions'],
	operation: ['withdrawFeedback'],
};

const instructionsAnyDisplay = {
	resource: ['instructions'],
	operation: ['getInstructions', 'queueFeedback', 'updateInstructions', 'withdrawFeedback'],
};

function stripEmpty(data: IDataObject): IDataObject {
	return Object.fromEntries(
		Object.entries(data).filter(([, value]) => value !== '' && value !== undefined && value !== null),
	);
}

function normalizeApiPath(path: string, node: INode): string {
	if (!path.trim()) return '/';
	if (path.startsWith('http://') || path.startsWith('https://')) {
		throw new NodeOperationError(
			node,
			'Use a path relative to https://www.tracira.com/api, for example /logs',
		);
	}
	return path.startsWith('/') ? path : `/${path}`;
}

function parseJsonObject(text: string, fieldName: string, node: INode): IDataObject {
	if (!text.trim()) return {};

	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		throw new NodeOperationError(node, `${fieldName} must be valid JSON`);
	}

	if (parsed === null || Array.isArray(parsed) || typeof parsed !== 'object') {
		throw new NodeOperationError(node, `${fieldName} must be a JSON object`);
	}

	return parsed as IDataObject;
}

function parseOptionalJsonBody(text: string): IDataObject | string | undefined {
	const trimmed = text.trim();
	if (!trimmed) return undefined;

	try {
		return JSON.parse(trimmed) as IDataObject;
	} catch {
		return text;
	}
}

function mapFullResponse(response: IN8nHttpFullResponse): IDataObject {
	return {
		statusCode: response.statusCode,
		headers: response.headers as IDataObject,
		body: response.body as IDataObject | string,
	};
}

export class Tracira implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Tracira',
		name: 'tracira',
		icon: { light: 'file:tracira.svg', dark: 'file:tracira.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Check and inspect your AI outputs in Tracira',
		usableAsTool: true,
		codex: {
			categories: ['Analytics'],
			resources: {
				credentialDocumentation: [
					{
						url: 'https://github.com/deepidealab/n8n-nodes-tracira?tab=readme-ov-file#credentials',
					},
				],
				primaryDocumentation: [
					{
						url: 'https://github.com/deepidealab/n8n-nodes-tracira?tab=readme-ov-file',
					},
				],
			},
			alias: ['Tracira AI', 'Tracera', 'AI monitoring', 'AI evaluation', 'LLM monitoring'],
		},
		defaults: {
			name: 'Tracira',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'traciraApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Output',
						value: 'log',
					},
					{
						name: 'Instruction',
						value: 'instructions',
					},
					{
						name: 'API',
						value: 'api',
					},
				],
				default: 'log',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: logResourceDisplay,
				},
				options: [
					{
						name: 'Download a File',
						value: 'download',
						action: 'Download a file',
						description:
							'Fetch a file stored on an output as binary data. Use it when a person asked the AI to redo the work and it needs the original document again.',
					},
					{
						name: 'Flag an Output',
						value: 'flag',
						action: 'Flag an output',
						description: 'Flag an already-checked output for human review, e.g. when an end-user reports an issue',
					},
					{
						name: 'Get an Output',
						value: 'get',
						action: 'Get an output',
						description:
							'Fetch a single output by ID, including verdict, explanation, and human decision',
					},
					{
						name: 'Search Outputs',
						value: 'search',
						action: 'Search outputs',
						description:
							'Return a filtered list of outputs from Tracira. Filter by status, project, task name, or date range.',
					},
					{
						name: 'Send an Output',
						value: 'log',
						action: 'Send an output',
						description:
							'Submit an AI output to Tracira to be checked against your rules. Returns a verdict, confidence score, and explanation based on your configured rules.',
					},
					{
						name: 'Set a Decision',
						value: 'setDecision',
						action: 'Set a decision',
						description:
							'Approve or reject an output, edit it, or record that a human took over',
					},
					{
						name: 'Update an Output',
						value: 'update',
						action: 'Update an output',
						description:
							'Change the details around an output already in Tracira: its metadata, its Session/Subject/Actor IDs, and the label on each attached file. The output, verdict and decision are never changed.',
					},
					{
						name: 'Upload a File',
						value: 'upload',
						action: 'Upload a file',
						description:
							'Upload a large file directly to Tracira storage, then attach it to an output by key. Name the file on that attachment, not here: an upload does not belong to an output yet.',
					},
				],
				default: 'log',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: instructionsResourceDisplay,
				},
				options: [
					{
						name: 'Get Instructions',
						value: 'getInstructions',
						action: 'Get instructions',
						description:
							'Fetch the current AI instructions (system prompt) stored in Tracira for a project and task. On the very first run, saves the Starter Instructions as version 1 and returns them.',
					},
					{
						name: 'Suggest an Instructions Change',
						value: 'queueFeedback',
						action: 'Suggest an instructions change',
						description:
							'Add feedback received outside Tracira (for example a correction typed in your own chat app) to the suggested update a manager reviews and accepts in Tracira',
					},
					{
						name: 'Update Instructions',
						value: 'updateInstructions',
						action: 'Update instructions',
						description:
							'Save a new version of the AI instructions in Tracira and make it active. Use after a reviewer sends a draft back with feedback.',
					},
					{
						name: 'Withdraw a Suggested Change',
						value: 'withdrawFeedback',
						action: 'Withdraw a suggested change',
						description:
							'Remove a change you suggested, by its reference, once it was settled in your own app. Returns code NOT_FOUND when a manager already accepted or dismissed it in Tracira.',
					},
				],
				default: 'getInstructions',
			},
			{
				displayName: 'Project Name',
				name: 'instructionsProject',
				type: 'resourceLocator',
				required: true,
				default: { mode: 'list', value: '' },
				displayOptions: {
					show: instructionsAnyDisplay,
				},
				description:
					'Must match the Project Name used in the Send an Output operation so the instructions and the outputs belong together',
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						type: 'list',
						default: '',
						typeOptions: {
							searchListMethod: 'getProjects',
							searchable: true,
						},
					},
					{
						displayName: 'Name',
						name: 'name',
						type: 'string',
						default: '',
					},
				],
			},
			{
				displayName: 'Task Name',
				name: 'instructionsTask',
				type: 'resourceLocator',
				required: true,
				default: { mode: 'list', value: '' },
				displayOptions: {
					show: instructionsAnyDisplay,
				},
				description: 'Must match the Task Name used in the Send an Output operation',
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						type: 'list',
						default: '',
						typeOptions: {
							searchListMethod: 'getTasks',
							searchable: true,
						},
					},
					{
						displayName: 'Name',
						name: 'name',
						type: 'string',
						default: '',
					},
				],
			},
			{
				displayName: 'Starter Instructions',
				name: 'starterInstructions',
				type: 'string',
				typeOptions: {
					rows: 6,
				},
				default: '',
				displayOptions: {
					show: instructionsGetDisplay,
				},
				description:
					'Optional. Used only the very first time this workflow runs: if no instructions exist yet in Tracira for this project and task, this text is saved as version 1 and returned. After that, the instructions stored in Tracira always win.',
			},
			{
				displayName: 'New Instructions',
				name: 'newInstructions',
				type: 'string',
				required: true,
				typeOptions: {
					rows: 6,
				},
				default: '',
				displayOptions: {
					show: instructionsUpdateDisplay,
				},
				description:
					'The full updated instructions text. Typically the output of an AI step that rewrote the current instructions to follow the reviewer feedback. This becomes the new active version.',
			},
			{
				displayName: 'Reviewer Feedback',
				name: 'teachComment',
				type: 'string',
				typeOptions: {
					rows: 3,
				},
				default: '',
				displayOptions: {
					show: instructionsUpdateDisplay,
				},
				description:
					'Optional. The reviewer comment that caused this update (map the Comment from the Tracira Trigger). Shown in the Tracira dashboard as the reason this version exists.',
			},
			{
				displayName: 'Output ID',
				name: 'instructionsLogId',
				type: 'string',
				default: '',
				displayOptions: {
					show: instructionsUpdateDisplay,
				},
				description: 'Optional. The Tracira output the feedback came from (map the Output ID from the Tracira Trigger).',
			},
			{
				displayName: 'Based On Version',
				name: 'baseVersion',
				type: 'number',
				typeOptions: {
					minValue: 0,
				},
				default: 0,
				displayOptions: {
					show: instructionsUpdateDisplay,
				},
				description:
					'Optional, recommended. The Version from the Get Instructions operation your New Instructions were written from. If the instructions changed since (a manager edited them or accepted a suggestion), nothing is saved and the node fails with VERSION_CONFLICT instead of overwriting the newer version. Leave at 0 to always save.',
			},
			{
				displayName: 'Suggested Change',
				name: 'suggestedChange',
				type: 'string',
				required: true,
				typeOptions: {
					rows: 3,
				},
				default: '',
				displayOptions: {
					show: instructionsQueueDisplay,
				},
				description:
					'What the AI should do differently, in plain words. A manager reviews it in Tracira and accepts it into the instructions. Up to 2,000 characters.',
			},
			{
				displayName: 'Suggested By',
				name: 'suggestedBy',
				type: 'string',
				default: '',
				displayOptions: {
					show: instructionsQueueDisplay,
				},
				description: "Optional. Who gave this feedback, shown on the suggestion in Tracira, for example 'Jeff (Telegram)'.",
			},
			{
				displayName: 'Your Reference',
				name: 'suggestionRef',
				type: 'string',
				default: '',
				displayOptions: {
					show: instructionsQueueDisplay,
				},
				description:
					'Optional. Your own ID for this suggestion. Sending the same reference again replaces the suggestion instead of adding a second one, and Withdraw a Suggested Change uses it.',
			},
			{
				displayName: 'Output ID',
				name: 'suggestionLogId',
				type: 'string',
				default: '',
				displayOptions: {
					show: instructionsQueueDisplay,
				},
				description: 'Optional. The Tracira output this feedback is about, so the manager can open it from the suggestion.',
			},
			{
				displayName: 'Your Reference',
				name: 'withdrawRef',
				type: 'string',
				required: true,
				default: '',
				displayOptions: {
					show: instructionsWithdrawDisplay,
				},
				description:
					'The Your Reference value sent with Suggest an Instructions Change. If a manager already accepted or dismissed the suggestion in Tracira, the node still succeeds and returns code NOT_FOUND.',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: apiDisplay,
				},
				options: [
					{
						name: 'Call',
						value: 'call',
						action: 'Make an API call',
						description: 'Perform an arbitrary authenticated Tracira API request',
					},
				],
				default: 'call',
			},
			{
				displayName: 'Output ID',
				name: 'logId',
				type: 'string',
				required: true,
				default: '',
				displayOptions: {
					show: getDisplay,
				},
				description: 'The output ID to fetch',
			},
			{
				displayName: 'Output ID',
				name: 'decisionLogId',
				type: 'string',
				required: true,
				default: '',
				displayOptions: {
					show: setDecisionDisplay,
				},
				description: 'The output ID to approve or reject',
			},
			{
				displayName: 'Decision',
				name: 'decision',
				type: 'options',
				required: true,
				default: 'approved',
				displayOptions: {
					show: setDecisionDisplay,
				},
				options: [
					{
						name: 'Approve',
						value: 'approved',
					},
					{
						name: 'Reject',
						value: 'rejected',
					},
					{
						name: 'Edit',
						value: 'changed',
						description:
							'The output was wrong. Send the corrected version, or a comment asking the AI to redo it.',
					},
					{
						name: 'Take Over',
						value: 'handled',
						description:
							'A human handled this outside Tracira. The task is done and the AI output went unused. Records no teaching signal.',
					},
				],
				description:
					'Approve or reject the output, edit it, or record that a human took over. Reject always means the workflow does not proceed - it never means "do the opposite"; to reverse a call the AI made, use Edit with the corrected value.',
			},
			{
				displayName: 'How',
				name: 'editMode',
				type: 'options',
				required: true,
				// Defaults to 'redo' for backward compatibility, NOT because it is the
				// better path. A workflow saved before this field existed has no value
				// for it, so n8n supplies this default; 'corrected' would make those
				// workflows ignore their comment and fail on an empty Corrected Output.
				default: 'redo',
				displayOptions: {
					show: {
						...setDecisionDisplay,
						decision: ['changed'],
					},
				},
				options: [
					{
						name: 'I Have the Corrected Version',
						value: 'corrected',
						description:
							'Send the fixed output. Nothing is regenerated, so there is no second review round.',
					},
					{
						name: 'Ask the AI to Redo It',
						value: 'redo',
						description: 'Send an instruction back to the AI so it can rewrite the output',
					},
				],
				description:
					'Send the corrected version when you already know the right answer: it is the faster path and teaches Tracira more. Ask the AI to redo it when the output needs rewriting rather than fixing.',
			},
			{
				displayName: 'Corrected Output',
				name: 'correctedOutput',
				type: 'string',
				typeOptions: {
					rows: 4,
				},
				required: true,
				default: '',
				displayOptions: {
					show: {
						...setDecisionDisplay,
						decision: ['changed'],
						editMode: ['corrected'],
					},
				},
				description:
					'The corrected version of the output, in the same shape the workflow submitted (plain text, or the same JSON fields). The workflow acts on this version. It arrives on the Tracira Trigger as both output and correctedOutput.',
			},
			{
				displayName: 'Comment',
				name: 'comment',
				type: 'string',
				typeOptions: {
					rows: 3,
				},
				required: true,
				default: '',
				displayOptions: {
					show: {
						...setDecisionDisplay,
						decision: ['changed'],
						editMode: ['redo'],
					},
				},
				description:
					'The instruction sent back to the AI describing what to change. The AI should regenerate the output and resubmit it with the Send an Output operation, setting Revision Of to this output ID.',
			},
			{
				displayName: 'Output ID',
				name: 'flagLogId',
				type: 'string',
				required: true,
				default: '',
				displayOptions: {
					show: flagDisplay,
				},
				description: 'The output ID to flag for review',
			},
			{
				displayName: 'Reason',
				name: 'flagReason',
				type: 'string',
				typeOptions: {
					rows: 3,
				},
				default: '',
				displayOptions: {
					show: flagDisplay,
				},
				description:
					'Optional reason for flagging, stored as the output explanation, for example the message your end-user submitted when reporting the issue',
			},
			{
				displayName: 'Flagged By',
				name: 'flaggedBy',
				type: 'options',
				default: 'end_user',
				displayOptions: {
					show: flagDisplay,
				},
				options: [
					{
						name: 'An End-User Reported It',
						value: 'end_user',
						description: 'A real person asked for the output to be looked at',
					},
					{
						name: 'This Workflow Decided',
						value: 'api',
						description: 'Your own logic made the call, with no person involved',
					},
				],
				description:
					'Who asked for the review. The reviewer reads this next to the reason, so pick the one that is true: telling a manager an end-user reported an issue when the workflow made the call is misleading.',
			},
			{
				displayName: 'Output ID',
				name: 'updateLogId',
				type: 'string',
				required: true,
				default: '',
				displayOptions: {
					show: updateDisplay,
				},
				description: 'The output to update. Map the Output ID from Send an Output, or from the Decision trigger.',
			},
			{
				displayName: 'Metadata',
				name: 'updateMetadata',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
				},
				placeholder: 'Add Metadata',
				default: {},
				displayOptions: {
					show: updateDisplay,
				},
				description:
					'Details you only learned after the output was sent: a ticket number your CRM assigned, a category a later step decided, the outcome of the call. Only the keys listed here change; everything else stays.',
				options: [
					{
						name: 'entry',
						displayName: 'Entry',
						values: [
							{
								displayName: 'Key',
								name: 'key',
								type: 'string',
								default: '',
							},
							{
								displayName: 'Value',
								name: 'value',
								type: 'string',
								default: '',
								description:
									'Leave empty and this row is skipped: an empty value means the field had nothing in it, not that the key should go. To delete a key, name it under Remove Metadata Keys.',
							},
						],
					},
				],
			},
			{
				displayName: 'Metadata (JSON)',
				name: 'updateMetadataJson',
				type: 'json',
				default: '',
				displayOptions: {
					show: updateDisplay,
				},
				description:
					'Optional. A whole JSON object stored alongside the Metadata rows above, for values that are themselves structured: an invoice with its line items, a scoring breakdown, an address. The rows can only hold plain text. If a key appears in both, the row wins.',
			},
			{
				displayName: 'Remove Metadata Keys',
				name: 'metadataRemove',
				type: 'string',
				default: '',
				displayOptions: {
					show: updateDisplay,
				},
				placeholder: 'crm_stage, priority',
				description:
					'Comma-separated names of metadata keys to delete from this output. Use this rather than an empty value: it says delete unambiguously. A name that is not on the output is ignored.',
			},
			{
				displayName: 'Existing Metadata',
				name: 'metadataMode',
				type: 'options',
				default: 'merge',
				displayOptions: {
					show: updateDisplay,
				},
				options: [
					{
						name: 'Keep It and Add These',
						value: 'merge',
						description: 'Only the keys listed above change; every other key already stored stays',
					},
					{
						name: 'Replace It With These',
						value: 'replace',
						description:
							'The keys listed above become the only metadata on the output. With no keys listed, all metadata is cleared.',
					},
				],
				description: 'What happens to metadata already stored on the output',
			},
			{
				displayName: 'File Labels',
				name: 'fileLabels',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
				},
				placeholder: 'Add File Label',
				default: {},
				displayOptions: {
					show: updateDisplay,
				},
				description:
					'Say what each file on this output is, so a reviewer looking at three photos knows which is which. Only renames files already on the output: to add one, use Send an Output.',
				options: [
					{
						name: 'file',
						displayName: 'File',
						values: [
							{
								displayName: 'File Key',
								name: 'key',
								type: 'string',
								default: '',
								description:
									'The File Key (or File URL) of a file already on this output. Take it from an attachment on the Decision trigger, Get an Output, or Download a File.',
							},
							{
								displayName: 'Label',
								name: 'label',
								type: 'string',
								default: '',
								description:
									'What this file is, in your own words: "Before photo", "Signed contract", "Customer ID card". Leave empty to clear the label.',
							},
						],
					},
				],
			},
			{
				displayName: 'Update Fields',
				name: 'updateFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: {
					show: updateDisplay,
				},
				options: [
					{
						displayName: 'Actor ID',
						name: 'actorId',
						type: 'string',
						default: '',
						description:
							'Fill in who triggered the execution, if it was not known when the output was sent',
					},
					{
						displayName: 'Session ID',
						name: 'sessionId',
						type: 'string',
						default: '',
						description:
							'Fill in the conversation or thread this output belongs to, if it was not known when the output was sent',
					},
					{
						displayName: 'Subject ID',
						name: 'subjectId',
						type: 'string',
						default: '',
						description:
							'Fill in the customer, ticket, account or record this output is about, if it was not known when the output was sent',
					},
				],
			},
			{
				displayName: 'Input Binary Field',
				name: 'binaryPropertyName',
				type: 'string',
				required: true,
				default: 'data',
				displayOptions: {
					show: uploadDisplay,
				},
				hint: 'The name of the input field containing the binary file to upload',
				description:
					'Name of the input binary field holding the file (PDF, image, or audio) to upload. The file goes straight to storage, bypassing the request size limit. Up to 32 MB.',
			},
			{
				displayName: 'File Name',
				name: 'uploadFileName',
				type: 'string',
				default: '',
				displayOptions: {
					show: uploadDisplay,
				},
				description:
					'Optional file name. Overrides the binary field name; its extension is used to detect the file type.',
			},
			{
				displayName: 'Content Type',
				name: 'uploadContentType',
				type: 'string',
				default: '',
				displayOptions: {
					show: uploadDisplay,
				},
				description:
					'Optional. Override the MIME type (e.g. application/pdf, image/png). Only needed when the file name has no recognizable extension.',
			},
			{
				displayName: 'File',
				name: 'downloadSource',
				type: 'string',
				required: true,
				default: '',
				displayOptions: {
					show: downloadDisplay,
				},
				hint: 'The File URL or File Key from an attachment on the Decision trigger, or from Get an Output',
				description:
					"Which stored file to fetch. Accepts the attachment's URL or its key; both name the same file.",
			},
			{
				displayName: 'Output Binary Field',
				name: 'downloadBinaryProperty',
				type: 'string',
				required: true,
				default: 'data',
				displayOptions: {
					show: downloadDisplay,
				},
				hint: 'The name of the output field the downloaded file is placed in',
				description:
					'Name of the binary field to put the file in, ready for an AI node to read',
			},
			{
				displayName: 'File Name',
				name: 'downloadFileName',
				type: 'string',
				default: '',
				displayOptions: {
					show: downloadDisplay,
				},
				description:
					'Optional. Renames the downloaded file. Leave empty to keep the name it was stored under.',
			},
			{
				displayName: 'Project Name',
				name: 'projectName',
				type: 'resourceLocator',
				required: true,
				default: { mode: 'list', value: '' },
				displayOptions: {
					show: logOperationDisplay,
				},
				description:
					'Select an existing project or enter a new name — it will be auto-created in Tracira on first use',
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						type: 'list',
						default: '',
						typeOptions: {
							searchListMethod: 'getProjects',
							searchable: true,
						},
					},
					{
						displayName: 'Name',
						name: 'name',
						type: 'string',
						default: '',
					},
				],
			},
			{
				displayName: 'Task Name',
				name: 'taskName',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				displayOptions: {
					show: logOperationDisplay,
				},
				description:
					'Optional. Select an existing task or enter a new name (e.g. "Tone Validator", "Reply Generator").',
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						type: 'list',
						default: '',
						typeOptions: {
							searchListMethod: 'getTasks',
							searchable: true,
						},
					},
					{
						displayName: 'Name',
						name: 'name',
						type: 'string',
						default: '',
					},
				],
			},
			{
				displayName: 'Input Text',
				name: 'input',
				type: 'string',
				typeOptions: {
					rows: 4,
				},
				default: '',
				displayOptions: {
					show: logOperationDisplay,
				},
				description: "Optional. The text the AI received: the user's message or the prompt. Shown on the person's side of the conversation.",
			},
			{
				displayName: 'Input Attachments',
				name: 'attachments',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
				},
				placeholder: 'Add Attachment',
				default: {},
				displayOptions: {
					show: logOperationDisplay,
				},
				description:
					'Files the AI received as input. Tracira auto-detects whether each attachment is an image, audio file, or document.',
				options: [
					{
						name: 'attachment',
						displayName: 'Attachment',
						values: [
							{
								displayName: 'Attachment Key',
								name: 'key',
								type: 'string',
								default: '',
								displayOptions: {
									show: {
										source: ['uploaded', 'stored'],
									},
								},
								description:
									'For "Tracira Upload", the key returned by an Upload a File operation — use it for files over 3 MB that cannot be sent inline. For "Already in Tracira", the File Key or File URL from an attachment on the Decision trigger, Get an Output, or Download a File. A re-attached file is copied, so deleting the earlier output leaves this one intact.',
							},
							{
								displayName: 'File Name',
								name: 'filename',
								type: 'string',
								default: '',
								description: 'Optional original file name shown to reviewers',
							},
							{
								displayName: 'Input Binary Field',
								name: 'binaryProperty',
								type: 'string',
								default: 'data',
								displayOptions: {
									show: {
										source: ['upload'],
									},
								},
								hint: 'The name of the input field containing the binary file to attach',
								description:
									'The file is sent inline with this request. The whole request is limited to 4.5 MB, so keep inline files under ~3 MB. For larger files, use the Upload a File operation first, then attach with source "Tracira Upload".',
							},
							{
								displayName: 'Label',
								name: 'label',
								type: 'string',
								default: '',
								description:
									'Optional. What this file is, in your own words: "Before photo", "Signed contract", "Customer ID card". Worth filling in whenever an output carries more than one file, so the reviewer and your later steps can tell them apart without reading file names. It comes back on the trigger\'s attachments. Set it here whichever source you picked: the Upload a File operation has no output to name the file against. With source "Already in Tracira" the label carries over from the output the file came from, so fill it in only to change it.',
							},
							{
								displayName: 'Source',
								name: 'source',
								type: 'options',
								default: 'upload',
								options: [
									{
										name: 'Already in Tracira',
										value: 'stored',
										description:
											'A file already stored on an earlier output — keeps the same document on this version without uploading it again',
									},
									{
										name: 'From URL',
										value: 'url',
										description: 'HTTPS URL to a publicly accessible file',
									},
									{
										name: 'Tracira Upload',
										value: 'uploaded',
										description:
											'A key returned by the Upload a File operation — use for files over ~3 MB',
									},
									{
										name: 'Upload File',
										value: 'upload',
										description:
											'Send a binary file inline with this request (keep under ~3 MB)',
									},
								],
								description: 'Where the file comes from',
							},
							{
								displayName: 'URL',
								name: 'url',
								type: 'string',
								default: '',
								displayOptions: {
									show: {
										source: ['url'],
									},
								},
								description: 'HTTPS URL to a publicly accessible image, audio file, or PDF',
							},
						],
					},
				],
			},
			{
				displayName: 'AI Output',
				name: 'output',
				type: 'string',
				typeOptions: {
					rows: 6,
				},
				default: '',
				displayOptions: {
					show: logOperationDisplay,
				},
				description:
					'What the AI produced, checked against your rules. Plain text or JSON: with JSON, rules can target individual fields. Optional if you add an Output Attachment.',
			},
			{
				displayName: 'Output Attachments',
				name: 'outputAttachments',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
				},
				placeholder: 'Add Attachment',
				default: {},
				displayOptions: {
					show: logOperationDisplay,
				},
				description:
					"Files the AI produced: generated images, synthesized audio, or rendered documents. Same options as Input Attachments; shown as the AI's reply in the conversation.",
				options: [
					{
						name: 'attachment',
						displayName: 'Attachment',
						values: [
							{
								displayName: 'Attachment Key',
								name: 'key',
								type: 'string',
								default: '',
								displayOptions: {
									show: {
										source: ['uploaded', 'stored'],
									},
								},
								description:
									'For "Tracira Upload", the key returned by an Upload a File operation — use it for files over 3 MB that cannot be sent inline. For "Already in Tracira", the File Key or File URL from an attachment on the Decision trigger, Get an Output, or Download a File. A re-attached file is copied, so deleting the earlier output leaves this one intact.',
							},
							{
								displayName: 'File Name',
								name: 'filename',
								type: 'string',
								default: '',
								description: 'Optional original file name shown to reviewers',
							},
							{
								displayName: 'Input Binary Field',
								name: 'binaryProperty',
								type: 'string',
								default: 'data',
								displayOptions: {
									show: {
										source: ['upload'],
									},
								},
								hint: 'The name of the input field containing the binary file to attach',
								description:
									'The file is sent inline with this request. The whole request is limited to 4.5 MB, so keep inline files under ~3 MB. For larger files, use the Upload a File operation first, then attach with source "Tracira Upload".',
							},
							{
								displayName: 'Label',
								name: 'label',
								type: 'string',
								default: '',
								description:
									'Optional. What this file is, in your own words: "Before photo", "Signed contract", "Customer ID card". Worth filling in whenever an output carries more than one file, so the reviewer and your later steps can tell them apart without reading file names. It comes back on the trigger\'s attachments. Set it here whichever source you picked: the Upload a File operation has no output to name the file against. With source "Already in Tracira" the label carries over from the output the file came from, so fill it in only to change it.',
							},
							{
								displayName: 'Source',
								name: 'source',
								type: 'options',
								default: 'upload',
								options: [
									{
										name: 'Already in Tracira',
										value: 'stored',
										description:
											'A file already stored on an earlier output — keeps the same document on this version without uploading it again',
									},
									{
										name: 'From URL',
										value: 'url',
										description: 'HTTPS URL to a publicly accessible file',
									},
									{
										name: 'Tracira Upload',
										value: 'uploaded',
										description:
											'A key returned by the Upload a File operation — use for files over ~3 MB',
									},
									{
										name: 'Upload File',
										value: 'upload',
										description:
											'Send a binary file inline with this request (keep under ~3 MB)',
									},
								],
								description: 'Where the file comes from',
							},
							{
								displayName: 'URL',
								name: 'url',
								type: 'string',
								default: '',
								displayOptions: {
									show: {
										source: ['url'],
									},
								},
								description: 'HTTPS URL to a publicly accessible image, audio file, or PDF',
							},
						],
					},
				],
			},
			{
				displayName: 'AI Model',
				name: 'modelName',
				type: 'string',
				default: '',
				displayOptions: {
					show: logOperationDisplay,
				},
				description:
					'Optional. The name of the AI model that produced this output, exactly as you use it — e.g. "gpt-4o", "claude-sonnet-4-5".',
			},
			{
				displayName: 'After Check',
				name: 'mode',
				type: 'options',
				default: 'verdict',
				displayOptions: {
					show: logOperationDisplay,
				},
				options: [
					{
						name: 'Wait for the Verdict',
						value: 'verdict',
						description:
							'Wait for the result and return status, verdict and confidence so you can branch on it (capped at 30s)',
					},
					{
						name: 'Do Not Wait, Just Log It',
						value: 'async',
						description:
							'Return immediately (HTTP 202) and evaluate in the background, for high-volume logging',
					},
					{
						name: 'Wait for a Human to Approve',
						value: 'approval',
						description:
							'Return immediately and hold the output in the review queue whatever the rules conclude, so the gate holds even with no matching rule. A person approves or rejects before your workflow acts. Reveals the action and callback fields.',
					},
				],
				description: 'What Tracira does once it has checked the output',
			},
			{
				displayName: 'Action Name',
				name: 'actionName',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: { resource: ['log'], operation: ['log'], mode: ['approval'] },
				},
				description:
					"Machine name of the step the AI wants to run, e.g. 'issue_refund' or 'delete_lead'. This is what the human approves or rejects.",
			},
			{
				displayName: 'Action Summary',
				name: 'actionSummary',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: { resource: ['log'], operation: ['log'], mode: ['approval'] },
				},
				description:
					"Plain-language description of exactly what will happen, e.g. 'Refund €49.00 to Alice Martin (order #8841)'. Reviewers read this verbatim to approve or reject.",
			},
			{
				displayName: 'Action Parameters (JSON)',
				name: 'actionParamsJson',
				type: 'string',
				typeOptions: { rows: 3 },
				default: '',
				displayOptions: {
					show: { resource: ['log'], operation: ['log'], mode: ['approval'] },
				},
				description:
					'Optional JSON object of the action\'s parameters, e.g. {"amount": 49}. Usable in data-field rules via paths like action.params.amount.',
			},
			{
				displayName: 'Callback URL',
				name: 'callbackUrl',
				type: 'string',
				default: '',
				displayOptions: {
					show: { resource: ['log'], operation: ['log'], mode: ['approval'] },
				},
				description:
					'Optional. A URL Tracira calls when the human decides, so your workflow can resume. Leave blank to poll with the Tracira Trigger instead.',
			},
			{
				displayName: 'Callback Events',
				name: 'callbackEvents',
				type: 'options',
				default: 'all',
				displayOptions: {
					show: { resource: ['log'], operation: ['log'], mode: ['approval'] },
				},
				options: [
					{ name: 'All Events (Default)', value: 'all' },
					{ name: 'Flagged & Errors Only', value: 'flagged_error' },
					{ name: 'Flagged, Errors & Decisions', value: 'flagged_error_decisions' },
					{ name: 'Human Decisions Only', value: 'decisions' },
					{ name: 'Pass Only', value: 'pass' },
				],
				description: 'Which events trigger the Callback URL',
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				displayOptions: {
					show: logOperationDisplay,
				},
				options: [
					{
						displayName: 'Actor ID',
						name: 'actorId',
						type: 'string',
						default: '',
					},
					{
						displayName: 'Confidence',
						name: 'confidence',
						type: 'number',
						default: 0,
					},
					{
						displayName: 'Cost (USD)',
						name: 'costUsd',
						type: 'number',
						default: 0,
					},
					{
						displayName: 'Instructions Version',
						name: 'instructionsVersion',
						type: 'number',
						default: 0,
						description:
							'Optional. The Version returned by the Get Instructions operation. The output then links back to the exact instructions the AI ran with, and reviewers can open them from the output.',
					},
					{
						displayName: 'Latency',
						name: 'latencyMs',
						type: 'number',
						default: 0,
						description: 'Duration of the AI call in milliseconds',
					},
					{
						displayName: 'Metadata',
						name: 'metadata',
						type: 'fixedCollection',
						typeOptions: {
							multipleValues: true,
						},
						placeholder: 'Add Metadata Field',
						default: {},
						description:
							'Extra context stored with the output as searchable fields (e.g. subject, priority). Add one row per field: a key and its value. Empty values are dropped server-side, so a sometimes-blank field never fails the submission.',
						options: [
							{
								name: 'entry',
								displayName: 'Field',
								values: [
									{
										displayName: 'Key',
										name: 'key',
										type: 'string',
										default: '',
									},
									{
										displayName: 'Value',
										name: 'value',
										type: 'string',
										default: '',
									},
								],
							},
						],
					},
					{
						displayName: 'Metadata JSON',
						name: 'metadataJson',
						type: 'string',
						typeOptions: {
							rows: 4,
						},
						default: '',
						description:
							'Advanced: a raw JSON object of metadata, for when the values come from one upstream object. The Metadata rows above merge over this. Keys whose value is empty (null or a blank string) are dropped server-side; values like 0 or false are kept.',
					},
					{
						displayName: 'Output ID',
						name: 'id',
						type: 'string',
						default: '',
					},
					{
						displayName: 'Revision Of',
						name: 'revisionOf',
						type: 'string',
						default: '',
						description:
							'The original output ID when this submission is a regeneration triggered by a Changed decision. Tracira links the two as a revision chain so reviewers see every attempt.',
					},
					{
						displayName: 'Session ID',
						name: 'sessionId',
						type: 'string',
						default: '',
					},
					{
						displayName: 'Subject ID',
						name: 'subjectId',
						type: 'string',
						default: '',
					},
					{
						displayName: 'Timestamp',
						name: 'timestamp',
						type: 'dateTime',
						default: '',
						description: 'Optional. Override the output timestamp: useful when replaying or reprocessing past executions. Leave blank to use the current time.',
					},
				],
			},
			{
				displayName: 'Status',
				name: 'status',
				type: 'options',
				default: '',
				displayOptions: {
					show: getAllDisplay,
				},
				options: [
					{ name: 'All', value: '' },
					{ name: 'Error', value: 'error' },
					{ name: 'Flagged', value: 'flagged' },
					{ name: 'Pass', value: 'pass' },
					{ name: 'Pending', value: 'pending' },
				],
				description: 'Filter outputs by status',
			},
			{
				displayName: 'Project Name',
				name: 'projectFilter',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				displayOptions: {
					show: getAllDisplay,
				},
				description: 'Optional. Filter outputs to a specific project name.',
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						type: 'list',
						default: '',
						typeOptions: {
							searchListMethod: 'getProjects',
							searchable: true,
						},
					},
					{
						displayName: 'Name',
						name: 'name',
						type: 'string',
						default: '',
					},
				],
			},
			{
				displayName: 'Task Name',
				name: 'taskFilter',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				displayOptions: {
					show: getAllDisplay,
				},
				description: 'Optional. Filter outputs to a specific task name within a project.',
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						type: 'list',
						default: '',
						typeOptions: {
							searchListMethod: 'getTasks',
							searchable: true,
						},
					},
					{
						displayName: 'Name',
						name: 'name',
						type: 'string',
						default: '',
					},
				],
			},
			{
				displayName: 'Search Query',
				name: 'query',
				type: 'string',
				default: '',
				displayOptions: {
					show: getAllDisplay,
				},
				description: 'Search across project, task, model, and context IDs',
			},
			{
				displayName: 'From Date',
				name: 'from',
				type: 'dateTime',
				default: '',
				displayOptions: {
					show: getAllDisplay,
				},
				description: 'Only include outputs at or after this date',
			},
			{
				displayName: 'To Date',
				name: 'to',
				type: 'dateTime',
				default: '',
				displayOptions: {
					show: getAllDisplay,
				},
				description: 'Only include outputs up to this date',
			},
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				typeOptions: {
					minValue: 1,
					maxValue: 100,
				},
				default: 50,
				displayOptions: {
					show: getAllDisplay,
				},
				description: 'Max number of results to return',
			},
			{
				displayName: 'Page',
				name: 'page',
				type: 'number',
				typeOptions: {
					minValue: 1,
				},
				default: 1,
				displayOptions: {
					show: getAllDisplay,
				},
				description: 'Results page number',
			},
			{
				displayName: 'Additional Filters',
				name: 'filters',
				type: 'collection',
				placeholder: 'Add Filter',
				default: {},
				displayOptions: {
					show: getAllDisplay,
				},
				options: [
					{
						displayName: 'Actor ID',
						name: 'actorId',
						type: 'string',
						default: '',
					},
					{
						displayName: 'Session ID',
						name: 'sessionId',
						type: 'string',
						default: '',
					},
					{
						displayName: 'Subject ID',
						name: 'subjectId',
						type: 'string',
						default: '',
					},
				],
			},
			{
				displayName: 'Path',
				name: 'apiPath',
				type: 'string',
				required: true,
				default: '/logs',
				displayOptions: {
					show: apiCallDisplay,
				},
				description: 'Path relative to https://www.tracira.com/api',
			},
			{
				displayName: 'Method',
				name: 'apiMethod',
				type: 'options',
				required: true,
				default: 'GET',
				displayOptions: {
					show: apiCallDisplay,
				},
				options: [
					{ name: 'DELETE', value: 'DELETE' },
					{ name: 'GET', value: 'GET' },
					{ name: 'PATCH', value: 'PATCH' },
					{ name: 'POST', value: 'POST' },
					{ name: 'PUT', value: 'PUT' },
				],
				description: 'HTTP method to use',
			},
			{
				displayName: 'Headers JSON',
				name: 'apiHeadersJson',
				type: 'string',
				typeOptions: {
					rows: 4,
				},
				default: '{}',
				displayOptions: {
					show: apiCallDisplay,
				},
				description: 'Optional JSON object of request headers. Authorization is added automatically.',
			},
			{
				displayName: 'Query String JSON',
				name: 'apiQueryJson',
				type: 'string',
				typeOptions: {
					rows: 4,
				},
				default: '{}',
				displayOptions: {
					show: apiCallDisplay,
				},
				description: 'Optional JSON object of query-string parameters',
			},
			{
				displayName: 'Body',
				name: 'apiBody',
				type: 'string',
				typeOptions: {
					rows: 6,
				},
				default: '',
				displayOptions: {
					show: apiCallDisplay,
				},
				description: 'Optional request body. JSON text is parsed automatically; other text is sent as-is.',
			},
		] as INodeProperties[],
	};

	methods = {
		listSearch: {
			getProjects,
			getTasks,
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const resource = this.getNodeParameter('resource', itemIndex) as string;
				const operation = this.getNodeParameter('operation', itemIndex) as string;
				let requestOptions: IHttpRequestOptions;

				if (resource === 'log' && operation === 'log') {
					const options = this.getNodeParameter('options', itemIndex, {}) as IDataObject;
					let metadata: IDataObject | undefined;

					if (options.metadataJson) {
						try {
							metadata = JSON.parse(options.metadataJson as string) as IDataObject;
						} catch {
							throw new NodeOperationError(this.getNode(), 'Metadata JSON must be valid JSON', {
								itemIndex,
							});
						}
					}

					// Metadata rows (the simple UI) merge over any JSON blob, so a row wins
					// when both set the same key.
					const metadataEntries = ((options.metadata as IDataObject | undefined)?.entry ??
						[]) as Array<{ key?: string; value?: string }>;
					if (metadataEntries.length) {
						metadata = { ...(metadata ?? {}) };
						for (const { key, value } of metadataEntries) {
							if (key) metadata[key] = value ?? '';
						}
					}

					// "After Check" drives everything: sync waits for the verdict,
					// approval reveals the proposed-action and callback fields.
					const mode = this.getNodeParameter('mode', itemIndex, 'verdict') as string;

					// Proposed action: only in approval mode, when a name or summary is set.
					let action: IDataObject | undefined;
					if (mode === 'approval') {
						const actionName = this.getNodeParameter('actionName', itemIndex, '') as string;
						const actionSummary = this.getNodeParameter('actionSummary', itemIndex, '') as string;
						const actionParamsJson = this.getNodeParameter('actionParamsJson', itemIndex, '') as string;
						if (actionName || actionSummary) {
							let params: IDataObject | undefined;
							if (actionParamsJson) {
								try {
									params = JSON.parse(actionParamsJson) as IDataObject;
								} catch {
									throw new NodeOperationError(this.getNode(), 'Action Parameters must be valid JSON', {
										itemIndex,
									});
								}
							}
							action = stripEmpty({
								name: actionName || undefined,
								summary: actionSummary || undefined,
								params,
							});
						}
					}

					// Input and output attachments share the same row shape; only the
					// request field they land in differs.
					const collectAttachments = async (paramName: string): Promise<IDataObject[]> => {
						const param = this.getNodeParameter(paramName, itemIndex, {}) as IDataObject;
						const rows = (param.attachment as IDataObject[] | undefined) ?? [];
						const collected: IDataObject[] = [];

						for (const row of rows) {
							if (row.source === 'upload') {
								const binaryProperty = (row.binaryProperty as string) || 'data';
								const binary = this.helpers.assertBinaryData(itemIndex, binaryProperty);
								const buffer = await this.helpers.getBinaryDataBuffer(itemIndex, binaryProperty);

								collected.push(
									stripEmpty({
										source: 'upload',
										data: buffer.toString('base64'),
										filename: (row.filename as string) || binary.fileName || 'file',
										label: row.label as string | undefined,
									}),
								);
								continue;
							}

							const entry = stripEmpty({
								source: row.source as string | undefined,
								key: row.key as string | undefined,
								url: row.url as string | undefined,
								filename: row.filename as string | undefined,
								label: row.label as string | undefined,
							});

							if (entry.key !== undefined || entry.url !== undefined) {
								collected.push(entry);
							}
						}

						return collected;
					};

					const attachments = await collectAttachments('attachments');
					const outputAttachments = await collectAttachments('outputAttachments');

					requestOptions = {
						method: 'POST',
						url: `${baseUrl}/logs`,
						body: stripEmpty({
							project: this.getNodeParameter('projectName', itemIndex, '', {
								extractValue: true,
							}) as string,
							output: this.getNodeParameter('output', itemIndex, '') as string,
							input: this.getNodeParameter('input', itemIndex, '') as string,
							task: this.getNodeParameter('taskName', itemIndex, '', {
								extractValue: true,
							}) as string,
							model: this.getNodeParameter('modelName', itemIndex, '') as string,
							attachments: attachments.length ? attachments : undefined,
							outputAttachments: outputAttachments.length ? outputAttachments : undefined,
							action,
							actorId: options.actorId as string | undefined,
							callbackUrl:
								mode === 'approval'
									? (this.getNodeParameter('callbackUrl', itemIndex, '') as string) || undefined
									: undefined,
							callbackEvents:
								mode === 'approval'
									? (this.getNodeParameter('callbackEvents', itemIndex, 'all') as string)
									: undefined,
							confidence: options.confidence as number | undefined,
							costUsd: options.costUsd as number | undefined,
							id: options.id as string | undefined,
							instructionsVersion: (options.instructionsVersion as number | undefined) || undefined,
							revisionOf: options.revisionOf as string | undefined,
							latencyMs: options.latencyMs as number | undefined,
							metadata,
							sessionId: options.sessionId as string | undefined,
							subjectId: options.subjectId as string | undefined,
							sync: mode === 'verdict',
							// The rules answer "is this wrong?", never "may this proceed?": with no
							// rule matching the project and task an output evaluates as pass, so
							// without this flag approval mode would log and let the action run
							// unreviewed. Omitted outside approval mode rather than sent as false.
							requireApproval: mode === 'approval' ? true : undefined,
							timestamp: options.timestamp as string | undefined,
						}),
					};
				} else if (resource === 'instructions' && operation === 'getInstructions') {
					requestOptions = {
						method: 'POST',
						url: `${baseUrl}/instructions`,
						body: stripEmpty({
							project: this.getNodeParameter('instructionsProject', itemIndex, '', {
								extractValue: true,
							}) as string,
							task: this.getNodeParameter('instructionsTask', itemIndex, '', {
								extractValue: true,
							}) as string,
							default: this.getNodeParameter('starterInstructions', itemIndex, '') as string,
						}),
					};
				} else if (resource === 'instructions' && operation === 'updateInstructions') {
					requestOptions = {
						method: 'POST',
						url: `${baseUrl}/instructions/versions`,
						body: stripEmpty({
							project: this.getNodeParameter('instructionsProject', itemIndex, '', {
								extractValue: true,
							}) as string,
							task: this.getNodeParameter('instructionsTask', itemIndex, '', {
								extractValue: true,
							}) as string,
							content: this.getNodeParameter('newInstructions', itemIndex) as string,
							teachComment: this.getNodeParameter('teachComment', itemIndex, '') as string,
							logId: this.getNodeParameter('instructionsLogId', itemIndex, '') as string,
							baseVersion: (this.getNodeParameter('baseVersion', itemIndex, 0) as number) || undefined,
						}),
					};
				} else if (resource === 'instructions' && operation === 'queueFeedback') {
					requestOptions = {
						method: 'POST',
						url: `${baseUrl}/instructions/feedback`,
						body: stripEmpty({
							project: this.getNodeParameter('instructionsProject', itemIndex, '', {
								extractValue: true,
							}) as string,
							task: this.getNodeParameter('instructionsTask', itemIndex, '', {
								extractValue: true,
							}) as string,
							comment: this.getNodeParameter('suggestedChange', itemIndex) as string,
							author: this.getNodeParameter('suggestedBy', itemIndex, '') as string,
							ref: this.getNodeParameter('suggestionRef', itemIndex, '') as string,
							logId: this.getNodeParameter('suggestionLogId', itemIndex, '') as string,
						}),
					};
				} else if (resource === 'instructions' && operation === 'withdrawFeedback') {
					requestOptions = {
						method: 'DELETE',
						url: `${baseUrl}/instructions/feedback`,
						body: stripEmpty({
							project: this.getNodeParameter('instructionsProject', itemIndex, '', {
								extractValue: true,
							}) as string,
							task: this.getNodeParameter('instructionsTask', itemIndex, '', {
								extractValue: true,
							}) as string,
							ref: this.getNodeParameter('withdrawRef', itemIndex) as string,
						}),
						// A note that is no longer queued (404 NOT_FOUND) is an answer, not a
						// failure: the manager settled it in Tracira. Read the status ourselves.
						returnFullResponse: true,
						ignoreHttpStatusErrors: true,
					};
				} else if (resource === 'log' && operation === 'get') {
					const logId = this.getNodeParameter('logId', itemIndex) as string;

					requestOptions = {
						method: 'GET',
						url: `${baseUrl}/logs/${encodeURIComponent(logId)}`,
					};
				} else if (resource === 'log' && operation === 'search') {
					const filters = this.getNodeParameter('filters', itemIndex, {}) as IDataObject;

					requestOptions = {
						method: 'GET',
						url: `${baseUrl}/logs`,
						qs: stripEmpty({
							status: this.getNodeParameter('status', itemIndex, '') as string,
							project: this.getNodeParameter('projectFilter', itemIndex, '', {
								extractValue: true,
							}) as string,
							task: this.getNodeParameter('taskFilter', itemIndex, '', {
								extractValue: true,
							}) as string,
							q: this.getNodeParameter('query', itemIndex, '') as string,
							from: this.getNodeParameter('from', itemIndex, '') as string,
							to: this.getNodeParameter('to', itemIndex, '') as string,
							limit: this.getNodeParameter('limit', itemIndex, 50) as number,
							page: this.getNodeParameter('page', itemIndex, 1) as number,
							actorId: filters.actorId as string | undefined,
							sessionId: filters.sessionId as string | undefined,
							subjectId: filters.subjectId as string | undefined,
						}),
					};
				} else if (resource === 'log' && operation === 'setDecision') {
					const logId = this.getNodeParameter('decisionLogId', itemIndex) as string;
					const decision = this.getNodeParameter('decision', itemIndex) as string;
					// An Edit is either the reviewer's own fix or an instruction to redo it,
					// never both: a corrected output means there is nothing to ask the AI for.
					const editMode =
						decision === 'changed'
							? (this.getNodeParameter('editMode', itemIndex, 'redo') as string)
							: '';
					const comment =
						editMode === 'redo'
							? (this.getNodeParameter('comment', itemIndex, '') as string)
							: '';
					const correctedOutput =
						editMode === 'corrected'
							? (this.getNodeParameter('correctedOutput', itemIndex, '') as string)
							: '';

					if (editMode === 'redo' && !comment.trim()) {
						throw new NodeOperationError(
							this.getNode(),
							'Comment is required when you ask the AI to redo the output',
							{ itemIndex },
						);
					}
					if (editMode === 'corrected' && !correctedOutput.trim()) {
						throw new NodeOperationError(
							this.getNode(),
							'Corrected Output is required when you send the corrected version',
							{ itemIndex },
						);
					}

					requestOptions = {
						method: 'PATCH',
						url: `${baseUrl}/logs/${encodeURIComponent(logId)}/decision`,
						body: stripEmpty({
							decision,
							comment: comment || undefined,
							correctedOutput: correctedOutput || undefined,
						}),
					};
				} else if (resource === 'log' && operation === 'flag') {
					const logId = this.getNodeParameter('flagLogId', itemIndex) as string;
					const reason = this.getNodeParameter('flagReason', itemIndex, '') as string;
					// Workflows saved before Flagged By existed fall back to end_user, the
					// behaviour this operation always had - their reviewers see no change.
					const flaggedBy = this.getNodeParameter('flaggedBy', itemIndex, 'end_user') as string;

					requestOptions = {
						method: 'PATCH',
						url: `${baseUrl}/logs/${encodeURIComponent(logId)}/status`,
						body: stripEmpty({
							status: 'flagged',
							reason,
							flaggedBy,
						}),
					};
				} else if (resource === 'log' && operation === 'update') {
					const logId = this.getNodeParameter('updateLogId', itemIndex) as string;
					const updateFields = this.getNodeParameter('updateFields', itemIndex, {}) as IDataObject;
					const metadataMode = this.getNodeParameter('metadataMode', itemIndex, 'merge') as string;

					const metadataRows = ((this.getNodeParameter('updateMetadata', itemIndex, {}) as IDataObject)
						.entry ?? []) as Array<{ key?: string; value?: string }>;
					// An empty value removes the key, the same way Tracira drops an empty
					// value at ingest, so a row mapped from a sometimes-blank field means
					// "no value" rather than two different things.
					let metadata: IDataObject | undefined;
					for (const { key, value } of metadataRows) {
						if (!key) continue;
						metadata = metadata ?? {};
						metadata[key] = value ?? '';
					}
					// Replace with no rows is how you clear every key, so the empty object
					// has to be sent rather than stripped.
					if (metadataMode === 'replace') metadata = metadata ?? {};

					const metadataJsonRaw = this.getNodeParameter('updateMetadataJson', itemIndex, '') as string;
					let metadataJson: IDataObject | undefined;
					if (metadataJsonRaw && metadataJsonRaw.trim()) {
						try {
							metadataJson = JSON.parse(metadataJsonRaw) as IDataObject;
						} catch {
							throw new NodeOperationError(this.getNode(), 'Metadata (JSON) must be valid JSON', {
								itemIndex,
							});
						}
					}

					const metadataRemove = (this.getNodeParameter('metadataRemove', itemIndex, '') as string)
						.split(',')
						.map((key) => key.trim())
						.filter((key) => key.length > 0);

					const labelRows = ((this.getNodeParameter('fileLabels', itemIndex, {}) as IDataObject)
						.file ?? []) as Array<{ key?: string; label?: string }>;
					const attachments: IDataObject[] = [];
					for (const row of labelRows) {
						const key = (row.key ?? '').trim();
						if (!key) continue;
						// label is sent even when empty: that is how a label is cleared.
						attachments.push({ key, label: row.label ?? '' });
					}

					if (
						metadata === undefined &&
						metadataJson === undefined &&
						metadataRemove.length === 0 &&
						attachments.length === 0 &&
						!updateFields.sessionId &&
						!updateFields.subjectId &&
						!updateFields.actorId
					) {
						throw new NodeOperationError(
							this.getNode(),
							'Nothing to update. Add a metadata row, a key to remove, a file label, or one of the Session / Subject / Actor IDs under Update Fields.',
							{ itemIndex },
						);
					}

					requestOptions = {
						method: 'PATCH',
						url: `${baseUrl}/logs/${encodeURIComponent(logId)}`,
						body: stripEmpty({
							metadata,
							// The API rejects a mode with no metadata to apply it to.
							metadataJson,
							// The mode governs the merged metadata, so it travels whenever either
							// half of it does.
							metadataMode:
								metadata === undefined && metadataJson === undefined ? undefined : metadataMode,
							metadataRemove: metadataRemove.length ? metadataRemove : undefined,
							attachments: attachments.length ? attachments : undefined,
							actorId: updateFields.actorId as string | undefined,
							sessionId: updateFields.sessionId as string | undefined,
							subjectId: updateFields.subjectId as string | undefined,
						}),
					};
				} else if (resource === 'log' && operation === 'upload') {
					const binaryPropertyName = this.getNodeParameter(
						'binaryPropertyName',
						itemIndex,
						'data',
					) as string;
					const fileNameOverride = this.getNodeParameter(
						'uploadFileName',
						itemIndex,
						'',
					) as string;

					const contentTypeOverride = this.getNodeParameter(
						'uploadContentType',
						itemIndex,
						'',
					) as string;

					const binary = this.helpers.assertBinaryData(itemIndex, binaryPropertyName);
					const buffer = await this.helpers.getBinaryDataBuffer(itemIndex, binaryPropertyName);
					const filename = fileNameOverride || binary.fileName || 'file';

					// 1. Create the upload (authenticated) — returns a presigned R2 URL.
					const presign = (await this.helpers.httpRequestWithAuthentication.call(
						this,
						'traciraApi',
						{
							method: 'POST',
							url: `${baseUrl}/uploads`,
							body: stripEmpty({
								filename,
								contentType: contentTypeOverride || binary.mimeType,
								sizeBytes: buffer.length,
							}),
						},
					)) as IDataObject;

					const uploadUrl = presign.uploadUrl as string | undefined;
					const key = presign.key as string | undefined;
					const contentType =
						(presign.contentType as string | undefined) ??
						(contentTypeOverride || binary.mimeType);

					if (!uploadUrl || !key) {
						throw new NodeOperationError(
							this.getNode(),
							'Tracira did not return an upload URL',
							{ itemIndex },
						);
					}

					// 2. PUT the bytes straight to R2 with NO Authorization header — the
					// presigned URL carries its own query signature, and an extra auth
					// header makes R2 reject the upload.
					await this.helpers.httpRequest({
						method: 'PUT',
						url: uploadUrl,
						body: buffer,
						headers: { 'Content-Type': contentType },
						json: false,
					});

					returnData.push({
						json: { key, contentType },
						pairedItem: itemIndex,
					});
					continue;
				} else if (resource === 'log' && operation === 'download') {
					const source = this.getNodeParameter('downloadSource', itemIndex) as string;
					const binaryPropertyName = this.getNodeParameter(
						'downloadBinaryProperty',
						itemIndex,
						'data',
					) as string;
					const fileNameOverride = this.getNodeParameter(
						'downloadFileName',
						itemIndex,
						'',
					) as string;

					// 1. Exchange the key or URL for a short-lived signed R2 URL. Done as
					// its own call rather than following the /media/{key} redirect: n8n
					// follows redirects and carries the Authorization header along, which
					// R2 rejects on a presigned request.
					const signed = (await this.helpers.httpRequestWithAuthentication.call(
						this,
						'traciraApi',
						{
							method: 'GET',
							url: `${baseUrl}/media-url`,
							qs: stripEmpty({ source, filename: fileNameOverride }),
						},
					)) as IDataObject;

					const signedUrl = signed.url as string | undefined;
					if (!signedUrl) {
						throw new NodeOperationError(
							this.getNode(),
							'Tracira did not return a download URL for this file',
							{ itemIndex },
						);
					}

					// 2. GET the bytes with no Authorization header, same reason as above.
					const fileBuffer = (await this.helpers.httpRequest({
						method: 'GET',
						url: signedUrl,
						encoding: 'arraybuffer',
						json: false,
					})) as Buffer;

					const filename =
						fileNameOverride || (signed.filename as string | undefined) || 'file';
					const binaryData = await this.helpers.prepareBinaryData(
						Buffer.from(fileBuffer),
						filename,
						signed.contentType as string | undefined,
					);

					returnData.push({
						// The key travels with the file so the same item can be handed
						// straight back to Send an Output as a "Stored in Tracira"
						// attachment, keeping the document on the new version.
						json: {
							key: signed.key ?? source,
							filename,
							contentType: signed.contentType,
							fileSize: signed.sizeBytes,
						},
						binary: { [binaryPropertyName]: binaryData },
						pairedItem: itemIndex,
					});
					continue;
				} else if (resource === 'api' && operation === 'call') {
					const headers = parseJsonObject(
						this.getNodeParameter('apiHeadersJson', itemIndex, '{}') as string,
						'Headers JSON',
						this.getNode(),
					);
					const qs = parseJsonObject(
						this.getNodeParameter('apiQueryJson', itemIndex, '{}') as string,
						'Query String JSON',
						this.getNode(),
					);
					const body = parseOptionalJsonBody(
						this.getNodeParameter('apiBody', itemIndex, '') as string,
					);

					requestOptions = {
						method: this.getNodeParameter('apiMethod', itemIndex) as IHttpRequestMethods,
						url: `${baseUrl}${normalizeApiPath(this.getNodeParameter('apiPath', itemIndex) as string, this.getNode())}`,
						headers,
						qs,
						body,
						returnFullResponse: true,
					};
				} else {
					throw new NodeOperationError(this.getNode(), `Unsupported Tracira operation: ${resource}/${operation}`, {
						itemIndex,
					});
				}

				const response = await this.helpers.httpRequestWithAuthentication.call(
					this,
					'traciraApi',
					requestOptions,
				);

				if (resource === 'instructions' && operation === 'withdrawFeedback') {
					const { statusCode, body } = response as IN8nHttpFullResponse;
					const result = (body ?? {}) as IDataObject;
					if (statusCode >= 400 && !(statusCode === 404 && result.code === 'NOT_FOUND')) {
						throw new NodeApiError(this.getNode(), result as JsonObject, {
							httpCode: String(statusCode),
							itemIndex,
						});
					}
					returnData.push({
						json: result,
						pairedItem: itemIndex,
					});
				} else if (resource === 'log' && operation === 'search' && Array.isArray(response?.executions)) {
					for (const log of response.executions) {
						returnData.push({
							json: log as IDataObject,
							pairedItem: itemIndex,
						});
					}
				} else if (resource === 'api' && operation === 'call' && response?.statusCode) {
					returnData.push({
						json: mapFullResponse(response as IN8nHttpFullResponse),
						pairedItem: itemIndex,
					});
				} else {
					returnData.push({
						json: response as IDataObject,
						pairedItem: itemIndex,
					});
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: (error as Error).message,
						},
						pairedItem: itemIndex,
					});
					continue;
				}

				// Validation errors are already NodeOperationError; wrap everything else
				// (HTTP failures) in NodeApiError to keep status code and response body.
				throw error instanceof NodeOperationError || error instanceof NodeApiError
					? error
					: new NodeApiError(this.getNode(), error as JsonObject, { itemIndex });
			}
		}

		return [returnData];
	}
}
