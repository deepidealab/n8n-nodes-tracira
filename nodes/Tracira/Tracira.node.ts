/* eslint-disable @n8n/community-nodes/node-usable-as-tool */
import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestOptions,
	INodeExecutionData,
	INodeProperties,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

const baseUrl = 'https://www.tracira.com/api';

const logDisplay = {
	resource: ['execution'],
	operation: ['log'],
};

const getDisplay = {
	resource: ['execution'],
	operation: ['get'],
};

const getAllDisplay = {
	resource: ['execution'],
	operation: ['getAll'],
};

function stripEmpty(data: IDataObject): IDataObject {
	return Object.fromEntries(
		Object.entries(data).filter(([, value]) => value !== '' && value !== undefined && value !== null),
	);
}

export class Tracira implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Tracira',
		name: 'tracira',
		icon: 'file:tracira.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Log and inspect Tracira AI execution data',
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
						name: 'Execution',
						value: 'execution',
					},
				],
				default: 'execution',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['execution'],
					},
				},
				options: [
					{
						name: 'Log',
						value: 'log',
						action: 'Log an execution',
						description: 'Send an AI execution to Tracira for evaluation',
					},
					{
						name: 'Get',
						value: 'get',
						action: 'Get an execution',
						description: 'Fetch a single execution by ID',
					},
					{
						name: 'Get Many',
						value: 'getAll',
						action: 'Get many an execution',
						description: 'List executions from Tracira',
					},
				],
				default: 'log',
			},
			{
				displayName: 'Execution ID',
				name: 'executionId',
				type: 'string',
				required: true,
				default: '',
				displayOptions: {
					show: getDisplay,
				},
				description: 'The execution ID to fetch',
			},
			{
				displayName: 'Flow',
				name: 'flowName',
				type: 'string',
				required: true,
				default: '',
				displayOptions: {
					show: logDisplay,
				},
				description: 'The Tracira flow name for this execution',
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
					show: logDisplay,
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
					show: logDisplay,
				},
				description: 'Optional prompt or input text that produced the output',
			},
			{
				displayName: 'Check',
				name: 'checkName',
				type: 'string',
				default: '',
				displayOptions: {
					show: logDisplay,
				},
				description: 'Optional Tracira check name',
			},
			{
				displayName: 'Model',
				name: 'modelName',
				type: 'string',
				default: '',
				displayOptions: {
					show: logDisplay,
				},
				description: 'Optional AI model name to record with the execution',
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				displayOptions: {
					show: logDisplay,
				},
				options: [
					{
						displayName: 'Actor ID',
						name: 'actorId',
						type: 'string',
						default: '',
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
						displayName: 'Execution ID',
						name: 'id',
						type: 'string',
						default: '',
					},
						{
							displayName: 'Latency',
							name: 'latencyMs',
							type: 'number',
							default: 0,
						},
					{
						displayName: 'Metadata JSON',
						name: 'metadataJson',
						type: 'string',
						typeOptions: {
							rows: 4,
						},
						default: '',
						description: 'Optional JSON object to store as execution metadata',
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
				displayName: 'Status',
				name: 'status',
				type: 'options',
				default: '',
				displayOptions: {
					show: getAllDisplay,
				},
				options: [
					{ name: 'All', value: '' },
					{ name: 'Success', value: 'success' },
					{ name: 'Flagged', value: 'flagged' },
					{ name: 'Failed', value: 'failed' },
				],
				description: 'Filter executions by status',
			},
			{
				displayName: 'Flow',
				name: 'flowFilter',
				type: 'string',
				default: '',
				displayOptions: {
					show: getAllDisplay,
				},
				description: 'Filter executions to a specific flow name',
			},
			{
				displayName: 'Check',
				name: 'checkFilter',
				type: 'string',
				default: '',
				displayOptions: {
					show: getAllDisplay,
				},
				description: 'Filter executions to a specific check name',
			},
			{
				displayName: 'Search Query',
				name: 'query',
				type: 'string',
				default: '',
				displayOptions: {
					show: getAllDisplay,
				},
				description: 'Search across flow, check, model, and context IDs',
			},
			{
				displayName: 'From',
				name: 'from',
				type: 'dateTime',
				default: '',
				displayOptions: {
					show: getAllDisplay,
				},
				description: 'Only include executions at or after this date',
			},
			{
				displayName: 'To',
				name: 'to',
				type: 'dateTime',
				default: '',
				displayOptions: {
					show: getAllDisplay,
				},
				description: 'Only include executions up to this date',
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
		] as INodeProperties[],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const operation = this.getNodeParameter('operation', itemIndex) as string;
				let requestOptions: IHttpRequestOptions;

				if (operation === 'log') {
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
							flow: this.getNodeParameter('flowName', itemIndex) as string,
							output: this.getNodeParameter('output', itemIndex) as string,
							input: this.getNodeParameter('input', itemIndex, '') as string,
							check: this.getNodeParameter('checkName', itemIndex, '') as string,
							model: this.getNodeParameter('modelName', itemIndex, '') as string,
							actorId: options.actorId as string | undefined,
							callbackUrl: options.callbackUrl as string | undefined,
							confidence: options.confidence as number | undefined,
							costUsd: options.costUsd as number | undefined,
							id: options.id as string | undefined,
							latencyMs: options.latencyMs as number | undefined,
							metadata,
							sessionId: options.sessionId as string | undefined,
							subjectId: options.subjectId as string | undefined,
						}),
					};
				} else if (operation === 'get') {
					const executionId = this.getNodeParameter('executionId', itemIndex) as string;

					requestOptions = {
						method: 'GET',
						url: `${baseUrl}/executions/${encodeURIComponent(executionId)}`,
					};
				} else {
					const filters = this.getNodeParameter('filters', itemIndex, {}) as IDataObject;

					requestOptions = {
						method: 'GET',
						url: `${baseUrl}/executions`,
						qs: stripEmpty({
							status: this.getNodeParameter('status', itemIndex, '') as string,
							flow: this.getNodeParameter('flowFilter', itemIndex, '') as string,
							check: this.getNodeParameter('checkFilter', itemIndex, '') as string,
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
				}

				const response = await this.helpers.httpRequestWithAuthentication.call(
					this,
					'traciraApi',
					requestOptions,
				);

				if (operation === 'getAll' && Array.isArray(response?.executions)) {
					for (const execution of response.executions) {
						returnData.push({
							json: execution as IDataObject,
							pairedItem: itemIndex,
						});
					}
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
