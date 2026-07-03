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
		description: 'Log and inspect Tracira AI log data',
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
						name: 'Log',
						value: 'log',
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
						name: 'Create a Log',
						value: 'log',
						action: 'Create a log',
						description:
							'Send an AI output to Tracira and create a log for evaluation. Returns a verdict, confidence score, and explanation based on your configured rules.',
					},
					{
						name: 'Flag a Log',
						value: 'flag',
						action: 'Flag a log',
						description: 'Flag an evaluated log for human review, e.g. when an end-user reports an issue',
					},
					{
						name: 'Get a Log',
						value: 'get',
						action: 'Get a log',
						description:
							'Fetch a single log by ID, including verdict, explanation, and human decision',
					},
					{
						name: 'Search Logs',
						value: 'search',
						action: 'Search logs',
						description:
							'Return a filtered list of logs from Tracira. Filter by status, project, task name, or date range.',
					},
					{
						name: 'Set a Decision',
						value: 'setDecision',
						action: 'Set a decision',
						description:
							'Approve, reject, or send a flagged log back to the AI with a comment',
					},
					{
						name: 'Upload a File',
						value: 'upload',
						action: 'Upload a file',
						description:
							'Upload a large file directly to Tracira storage, then attach it to a log by key',
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
				displayName: 'Log ID',
				name: 'logId',
				type: 'string',
				required: true,
				default: '',
				displayOptions: {
					show: getDisplay,
				},
				description: 'The log ID to fetch',
			},
			{
				displayName: 'Log ID',
				name: 'decisionLogId',
				type: 'string',
				required: true,
				default: '',
				displayOptions: {
					show: setDecisionDisplay,
				},
				description: 'The log ID to approve or reject',
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
						name: 'Send Back for Changes',
						value: 'changed',
						description: 'Send the log back to the AI with a comment to regenerate',
					},
				],
				description:
					'Approve or reject the flagged log, or send it back to the AI with a comment',
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
					},
				},
				description:
					'The instruction sent back to the AI describing what to change. Required when Decision is Send Back for Changes. The AI should regenerate the output and resubmit it with the Create a Log operation, setting Revision Of to this log ID.',
			},
			{
				displayName: 'Log ID',
				name: 'flagLogId',
				type: 'string',
				required: true,
				default: '',
				displayOptions: {
					show: flagDisplay,
				},
				description: 'The log ID to flag for review',
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
					'Optional reason for flagging, stored as the log explanation, for example the message your end-user submitted when reporting the issue',
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
						typeOptions: {
							searchListMethod: 'getProjects',
							searchable: true,
						},
					},
					{
						displayName: 'Name',
						name: 'name',
						type: 'string',
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
				required: true,
				default: '',
				displayOptions: {
					show: logOperationDisplay,
				},
				description: 'The AI-generated output to evaluate against your Tracira rules',
			},
			{
				displayName: 'Text Prompt',
				name: 'input',
				type: 'string',
				typeOptions: {
					rows: 4,
				},
				default: '',
				displayOptions: {
					show: logOperationDisplay,
				},
				description: 'Optional text sent to your AI model alongside any attachments',
			},
			{
				displayName: 'Attachments',
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
					'Files to attach to the log (the source the AI worked from). Tracira auto-detects whether each attachment is an image, audio file, or document.',
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
						typeOptions: {
							searchListMethod: 'getTasks',
							searchable: true,
						},
					},
					{
						displayName: 'Name',
						name: 'name',
						type: 'string',
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
						displayName: 'Latency',
						name: 'latencyMs',
						type: 'number',
						default: 0,
						description: 'Duration of the AI call in milliseconds',
					},
					{
						displayName: 'Log ID',
						name: 'id',
						type: 'string',
						default: '',
					},
					{
						displayName: 'Metadata JSON',
						name: 'metadataJson',
						type: 'string',
						typeOptions: {
							rows: 4,
						},
						default: '',
						description: 'Optional JSON object to store as log metadata',
					},
					{
						displayName: 'Revision Of',
						name: 'revisionOf',
						type: 'string',
						default: '',
						description:
							'The original log ID when this output is a regeneration triggered by a Changed decision. Tracira links the two as a revision chain so reviewers see every attempt.',
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
						description: 'Optional. Override the log timestamp — useful when replaying or reprocessing past executions. Leave blank to use the current time.',
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
				description: 'Filter logs by status',
			},
			{
				displayName: 'Project Name',
				name: 'projectFilter',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				displayOptions: {
					show: getAllDisplay,
				},
				description: 'Optional. Filter logs to a specific project name.',
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						type: 'list',
						typeOptions: {
							searchListMethod: 'getProjects',
							searchable: true,
						},
					},
					{
						displayName: 'Name',
						name: 'name',
						type: 'string',
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
				description: 'Optional. Filter logs to a specific task name within a project.',
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						type: 'list',
						typeOptions: {
							searchListMethod: 'getTasks',
							searchable: true,
						},
					},
					{
						displayName: 'Name',
						name: 'name',
						type: 'string',
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
				description: 'Only include logs at or after this date',
			},
			{
				displayName: 'To Date',
				name: 'to',
				type: 'dateTime',
				default: '',
				displayOptions: {
					show: getAllDisplay,
				},
				description: 'Only include logs up to this date',
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

					const attachmentsParam = this.getNodeParameter(
						'attachments',
						itemIndex,
						{},
					) as IDataObject;
					const attachmentRows = (attachmentsParam.attachment as IDataObject[] | undefined) ?? [];
					const attachments: IDataObject[] = [];

					for (const row of attachmentRows) {
						if (row.source === 'upload') {
							const binaryProperty = (row.binaryProperty as string) || 'data';
							const binary = this.helpers.assertBinaryData(itemIndex, binaryProperty);
							const buffer = await this.helpers.getBinaryDataBuffer(itemIndex, binaryProperty);

							attachments.push(
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
							attachments.push(entry);
						}
					}

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
							actorId: options.actorId as string | undefined,
							callbackUrl: options.callbackUrl as string | undefined,
							callbackEvents: options.callbackEvents as string | undefined,
							confidence: options.confidence as number | undefined,
							costUsd: options.costUsd as number | undefined,
							id: options.id as string | undefined,
							revisionOf: options.revisionOf as string | undefined,
							latencyMs: options.latencyMs as number | undefined,
							metadata,
							sessionId: options.sessionId as string | undefined,
							subjectId: options.subjectId as string | undefined,
							sync: this.getNodeParameter('sync', itemIndex, true) as boolean,
							timestamp: options.timestamp as string | undefined,
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
					const comment =
						decision === 'changed'
							? (this.getNodeParameter('comment', itemIndex, '') as string)
							: '';

					if (decision === 'changed' && !comment.trim()) {
						throw new NodeOperationError(
							this.getNode(),
							'Comment is required when Decision is Send Back for Changes',
							{ itemIndex },
						);
					}

					requestOptions = {
						method: 'PATCH',
						url: `${baseUrl}/logs/${encodeURIComponent(logId)}/decision`,
						body: stripEmpty({
							decision,
							comment: comment || undefined,
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
