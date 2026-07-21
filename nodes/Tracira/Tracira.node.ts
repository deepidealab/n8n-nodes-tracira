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

const uploadDisplay = {
	resource: ['log'],
	operation: ['upload'],
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

const instructionsAnyDisplay = {
	resource: ['instructions'],
	operation: ['getInstructions', 'updateInstructions'],
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
						name: 'Check an Output',
						value: 'log',
						action: 'Check an output',
						description:
							'Send an AI output to Tracira and have it checked against your rules. Returns a verdict, confidence score, and explanation based on your configured rules.',
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
						name: 'Set a Decision',
						value: 'setDecision',
						action: 'Set a decision',
						description:
							'Approve or reject an output, edit it, or record that a human took over',
					},
					{
						name: 'Upload a File',
						value: 'upload',
						action: 'Upload a file',
						description:
							'Upload a large file directly to Tracira storage, then attach it to an output by key',
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
						name: 'Update Instructions',
						value: 'updateInstructions',
						action: 'Update instructions',
						description:
							'Save a new version of the AI instructions in Tracira and make it active. Use after a reviewer sends a draft back with feedback.',
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
					'Must match the Project Name used in the Check an Output operation so the instructions and the outputs belong together',
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
				description: 'Must match the Task Name used in the Check an Output operation',
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
					'The instruction sent back to the AI describing what to change. The AI should regenerate the output and resubmit it with the Check an Output operation, setting Revision Of to this output ID.',
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
										source: ['uploaded'],
									},
								},
								description:
									'The key returned by an Upload a File operation. Use this for large files (over 3 MB) that cannot be sent inline.',
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
								displayName: 'Source',
								name: 'source',
								type: 'options',
								default: 'upload',
								options: [
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
					'The AI-generated text to evaluate against your Tracira rules. Required unless you add an Output Attachment (media-only outputs, e.g. a generated image).',
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
										source: ['uploaded'],
									},
								},
								description:
									'The key returned by an Upload a File operation. Use this for large files (over 3 MB) that cannot be sent inline.',
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
								displayName: 'Source',
								name: 'source',
								type: 'options',
								default: 'upload',
								options: [
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
				displayName: 'Wait for Verdict',
				name: 'sync',
				type: 'boolean',
				default: true,
				displayOptions: {
					show: logOperationDisplay,
				},
				description:
					'Whether to wait for evaluation to finish and return the full verdict (status, verdict, confidence, explanation) so you can branch on it. On by default; evaluation is capped at 30 seconds. Turn off for high-volume fire-and-forget logging — n8n continues immediately (HTTP 202) and Tracira evaluates in the background.',
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
						displayName: 'Action (Gate Mode)',
						name: 'action',
						type: 'fixedCollection',
						default: {},
						description:
							'When the AI output proposes an action to run (issue a refund, delete a record), describe it here so a human approves or rejects it before your workflow executes it. Combine with Callback URL.',
						options: [
							{
								displayName: 'Action',
								name: 'value',
								values: [
									{
										displayName: 'Name',
										name: 'name',
										type: 'string',
										default: '',
										description: "Machine name of the action, e.g. 'issue_refund' or 'delete_lead'",
									},
									{
										displayName: 'Summary',
										name: 'summary',
										type: 'string',
										default: '',
										description:
											"Plain-language description of exactly what will happen, e.g. 'Refund €49.00 to Alice Martin (order #8841)'. Reviewers read this to approve or reject.",
									},
									{
										displayName: 'Parameters (JSON)',
										name: 'paramsJson',
										type: 'string',
										typeOptions: { rows: 3 },
										default: '',
										description:
											'Optional JSON object of the action\'s parameters, e.g. {"amount": 49, "currency": "EUR"}. Shown to reviewers and usable in Tracira data-field rules via paths like action.params.amount. Keys with an empty value are dropped server-side, same as metadata.',
									},
								],
							},
						],
					},
					{
						displayName: 'Actor ID',
						name: 'actorId',
						type: 'string',
						default: '',
					},
					{
						displayName: 'Callback Events',
						name: 'callbackEvents',
						type: 'options',
						default: 'all',
						options: [
							{ name: 'All Events (Default)', value: 'all' },
							{ name: 'Flagged & Errors Only', value: 'flagged_error' },
							{ name: 'Flagged, Errors & Decisions', value: 'flagged_error_decisions' },
							{ name: 'Human Decisions Only', value: 'decisions' },
							{ name: 'Pass Only', value: 'pass' },
						],
						description: 'Controls which events trigger the Callback URL. Only used when Callback URL is set.',
					},
					{
						displayName: 'Callback URL',
						name: 'callbackUrl',
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
						displayName: 'Metadata JSON',
						name: 'metadataJson',
						type: 'string',
						typeOptions: {
							rows: 4,
						},
						default: '',
						description:
							'Optional JSON object to store as output metadata. Keys whose value is empty (null or a blank string) are dropped server-side, so a sometimes-blank field never fails the log; values like 0 or false are kept.',
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

					// Proposed action: only sent when a name or summary is filled in.
					let action: IDataObject | undefined;
					const actionParam = (options.action as IDataObject | undefined)?.value as
						| IDataObject
						| undefined;
					if (actionParam && (actionParam.name || actionParam.summary)) {
						let params: IDataObject | undefined;
						if (actionParam.paramsJson) {
							try {
								params = JSON.parse(actionParam.paramsJson as string) as IDataObject;
							} catch {
								throw new NodeOperationError(this.getNode(), 'Action Parameters must be valid JSON', {
									itemIndex,
								});
							}
						}
						action = stripEmpty({
							name: actionParam.name as string | undefined,
							summary: actionParam.summary as string | undefined,
							params,
						});
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
									}),
								);
								continue;
							}

							const entry = stripEmpty({
								source: row.source as string | undefined,
								key: row.key as string | undefined,
								url: row.url as string | undefined,
								filename: row.filename as string | undefined,
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
							output: this.getNodeParameter('output', itemIndex) as string,
							input: this.getNodeParameter('input', itemIndex, '') as string,
							task: this.getNodeParameter('taskName', itemIndex, '', {
								extractValue: true,
							}) as string,
							model: this.getNodeParameter('modelName', itemIndex, '') as string,
							attachments: attachments.length ? attachments : undefined,
							outputAttachments: outputAttachments.length ? outputAttachments : undefined,
							action,
							actorId: options.actorId as string | undefined,
							callbackUrl: options.callbackUrl as string | undefined,
							callbackEvents: options.callbackEvents as string | undefined,
							confidence: options.confidence as number | undefined,
							costUsd: options.costUsd as number | undefined,
							id: options.id as string | undefined,
							instructionsVersion: (options.instructionsVersion as number | undefined) || undefined,
							revisionOf: options.revisionOf as string | undefined,
							latencyMs: options.latencyMs as number | undefined,
							metadata,
							sessionId: options.sessionId as string | undefined,
							subjectId: options.subjectId as string | undefined,
							sync: this.getNodeParameter('sync', itemIndex, true) as boolean,
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
						}),
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

					requestOptions = {
						method: 'PATCH',
						url: `${baseUrl}/logs/${encodeURIComponent(logId)}/status`,
						body: stripEmpty({
							status: 'flagged',
							reason,
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

				if (resource === 'log' && operation === 'search' && Array.isArray(response?.executions)) {
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
				throw error instanceof NodeOperationError
					? error
					: new NodeApiError(this.getNode(), error as JsonObject, { itemIndex });
			}
		}

		return [returnData];
	}
}
