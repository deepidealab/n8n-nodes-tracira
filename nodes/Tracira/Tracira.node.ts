/* eslint-disable @n8n/community-nodes/node-usable-as-tool */
import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	IN8nHttpFullResponse,
	INodeExecutionData,
	INodeProperties,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { ApplicationError, NodeOperationError } from 'n8n-workflow';

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
	operation: ['getAll'],
};

const setDecisionDisplay = {
	resource: ['log'],
	operation: ['setDecision'],
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

function normalizeApiPath(path: string): string {
	if (!path.trim()) return '/';
	if (path.startsWith('http://') || path.startsWith('https://')) {
		throw new ApplicationError(
			'Use a path relative to https://www.tracira.com/api, for example /logs',
		);
	}
	return path.startsWith('/') ? path : `/${path}`;
}

function parseJsonObject(text: string, fieldName: string): IDataObject {
	if (!text.trim()) return {};

	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		throw new ApplicationError(`${fieldName} must be valid JSON`);
	}

	if (parsed === null || Array.isArray(parsed) || typeof parsed !== 'object') {
		throw new ApplicationError(`${fieldName} must be a JSON object`);
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
		icon: 'file:tracira.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Log and inspect Tracira AI log data',
		codex: {
			categories: ['AI'],
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
		inputs: ['main'],
		outputs: ['main'],
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
						name: 'Log',
						value: 'log',
						action: 'Log an AI output',
						description: 'Send an AI output to Tracira for evaluation',
					},
					{
						name: 'Get',
						value: 'get',
						action: 'Get a log',
						description: 'Fetch a single log by ID',
					},
					{
						name: 'Get Many',
						value: 'getAll',
						action: 'Get many logs',
						description: 'List logs from Tracira',
					},
					{
						name: 'Set Decision',
						value: 'setDecision',
						action: 'Set a decision for a log',
						description: 'Approve or reject a flagged log',
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
						name: 'Approved',
						value: 'approved',
					},
					{
						name: 'Rejected',
						value: 'rejected',
					},
				],
				description: 'The human review decision to record',
			},
			{
				displayName: 'Project',
				name: 'projectName',
				type: 'string',
				required: true,
				default: '',
				displayOptions: {
					show: logOperationDisplay,
				},
				description: 'The Tracira project name for this log',
			},
			{
				displayName: 'Output',
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
				description: 'The AI-generated output to evaluate in Tracira',
			},
			{
				displayName: 'Input',
				name: 'input',
				type: 'string',
				typeOptions: {
					rows: 4,
				},
				default: '',
				displayOptions: {
					show: logOperationDisplay,
				},
				description: 'Optional prompt or input text that produced the output',
			},
			{
				displayName: 'Task',
				name: 'taskName',
				type: 'string',
				default: '',
				displayOptions: {
					show: logOperationDisplay,
				},
				description: 'Optional Tracira task name',
			},
			{
				displayName: 'Model',
				name: 'modelName',
				type: 'string',
				default: '',
				displayOptions: {
					show: logOperationDisplay,
				},
				description: 'Optional AI model name to record with the log',
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
						displayName: 'Sync Mode (Wait for Verdict)',
						name: 'sync',
						type: 'boolean',
						default: false,
						description: 'Whether to wait for evaluation to complete before continuing. Off (default): n8n continues immediately, Tracira evaluates in the background. On: n8n waits for the full verdict so you can branch on status/verdict.',
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
				displayName: 'Project',
				name: 'projectFilter',
				type: 'string',
				default: '',
				displayOptions: {
					show: getAllDisplay,
				},
				description: 'Filter logs to a specific project name',
			},
			{
				displayName: 'Task',
				name: 'taskFilter',
				type: 'string',
				default: '',
				displayOptions: {
					show: getAllDisplay,
				},
				description: 'Filter logs to a specific task name',
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
				displayName: 'From',
				name: 'from',
				type: 'dateTime',
				default: '',
				displayOptions: {
					show: getAllDisplay,
				},
				description: 'Only include logs at or after this date',
			},
			{
				displayName: 'To',
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

					requestOptions = {
						method: 'POST',
						url: `${baseUrl}/webhook`,
						body: stripEmpty({
							project: this.getNodeParameter('projectName', itemIndex) as string,
							output: this.getNodeParameter('output', itemIndex) as string,
							input: this.getNodeParameter('input', itemIndex, '') as string,
							task: this.getNodeParameter('taskName', itemIndex, '') as string,
							model: this.getNodeParameter('modelName', itemIndex, '') as string,
							actorId: options.actorId as string | undefined,
							callbackUrl: options.callbackUrl as string | undefined,
							callbackEvents: options.callbackEvents as string | undefined,
							confidence: options.confidence as number | undefined,
							costUsd: options.costUsd as number | undefined,
							id: options.id as string | undefined,
							latencyMs: options.latencyMs as number | undefined,
							metadata,
							sessionId: options.sessionId as string | undefined,
							subjectId: options.subjectId as string | undefined,
							sync: options.sync as boolean | undefined,
						}),
					};
				} else if (resource === 'log' && operation === 'get') {
					const logId = this.getNodeParameter('logId', itemIndex) as string;

					requestOptions = {
						method: 'GET',
						url: `${baseUrl}/logs/${encodeURIComponent(logId)}`,
					};
				} else if (resource === 'log' && operation === 'getAll') {
					const filters = this.getNodeParameter('filters', itemIndex, {}) as IDataObject;

					requestOptions = {
						method: 'GET',
						url: `${baseUrl}/logs`,
						qs: stripEmpty({
							status: this.getNodeParameter('status', itemIndex, '') as string,
							project: this.getNodeParameter('projectFilter', itemIndex, '') as string,
							task: this.getNodeParameter('taskFilter', itemIndex, '') as string,
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

					requestOptions = {
						method: 'PATCH',
						url: `${baseUrl}/logs/${encodeURIComponent(logId)}/decision`,
						body: {
							decision,
						},
					};
				} else if (resource === 'api' && operation === 'call') {
					const headers = parseJsonObject(
						this.getNodeParameter('apiHeadersJson', itemIndex, '{}') as string,
						'Headers JSON',
					);
					const qs = parseJsonObject(
						this.getNodeParameter('apiQueryJson', itemIndex, '{}') as string,
						'Query String JSON',
					);
					const body = parseOptionalJsonBody(
						this.getNodeParameter('apiBody', itemIndex, '') as string,
					);

					requestOptions = {
						method: this.getNodeParameter('apiMethod', itemIndex) as IHttpRequestMethods,
						url: `${baseUrl}${normalizeApiPath(this.getNodeParameter('apiPath', itemIndex) as string)}`,
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

				if (resource === 'log' && operation === 'getAll' && Array.isArray(response?.executions)) {
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

				throw new NodeOperationError(
					this.getNode(),
					error instanceof Error ? error.message : 'Unknown Tracira error',
					{ itemIndex },
				);
			}
		}

		return [returnData];
	}
}
