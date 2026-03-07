import type { INodeProperties } from 'n8n-workflow';

const showOnlyForExecutionLog = {
	operation: ['log'],
	resource: ['execution'],
};

export const executionLogDescription: INodeProperties[] = [
	{
		displayName: 'Flow',
		name: 'flowName',
		type: 'resourceLocator',
		displayOptions: {
			show: showOnlyForExecutionLog,
		},
		default: { mode: 'list', value: '' },
		required: true,
		description: 'The Tracira flow name for this execution',
		modes: [
			{
				displayName: 'Flow',
				name: 'list',
				type: 'list',
				placeholder: 'Select a flow...',
				typeOptions: {
					searchListMethod: 'getFlows',
					searchable: true,
					searchFilterRequired: false,
				},
			},
			{
				displayName: 'By Name',
				name: 'name',
				type: 'string',
				placeholder: 'e.g. support-reply-flow',
			},
		],
		routing: {
			request: {
				body: {
					flow: '={{$value}}',
				},
			},
		},
	},
	{
		displayName: 'Output',
		name: 'output',
		type: 'string',
		typeOptions: {
			rows: 6,
		},
		displayOptions: {
			show: showOnlyForExecutionLog,
		},
		default: '',
		required: true,
		description: 'The AI-generated output to evaluate in Tracira',
		routing: {
			send: {
				type: 'body',
				property: 'output',
			},
		},
	},
	{
		displayName: 'Input',
		name: 'input',
		type: 'string',
		typeOptions: {
			rows: 4,
		},
		displayOptions: {
			show: showOnlyForExecutionLog,
		},
		default: '',
		description: 'Optional prompt or input text that produced the output',
		routing: {
			send: {
				type: 'body',
				property: 'input',
			},
		},
	},
	{
		displayName: 'Check',
		name: 'checkName',
		type: 'resourceLocator',
		displayOptions: {
			show: showOnlyForExecutionLog,
		},
		default: { mode: 'list', value: '' },
		description: 'Optional Tracira check name',
		modes: [
			{
				displayName: 'Check',
				name: 'list',
				type: 'list',
				placeholder: 'Select a check...',
				typeOptions: {
					searchListMethod: 'getChecks',
					searchable: true,
					searchFilterRequired: false,
				},
			},
			{
				displayName: 'By Name',
				name: 'name',
				type: 'string',
				placeholder: 'e.g. tone-validator',
			},
		],
		routing: {
			request: {
				body: {
					check: '={{$value}}',
				},
			},
		},
	},
	{
		displayName: 'Model',
		name: 'modelName',
		type: 'resourceLocator',
		displayOptions: {
			show: showOnlyForExecutionLog,
		},
		default: { mode: 'list', value: '' },
		description: 'Optional AI model name to record with the execution',
		modes: [
			{
				displayName: 'Model',
				name: 'list',
				type: 'list',
				placeholder: 'Select a model...',
				typeOptions: {
					searchListMethod: 'getModels',
					searchable: true,
					searchFilterRequired: false,
				},
			},
			{
				displayName: 'By Name',
				name: 'name',
				type: 'string',
				placeholder: 'e.g. gpt-5-mini',
			},
		],
		routing: {
			request: {
				body: {
					model: '={{$value}}',
				},
			},
		},
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		displayOptions: {
			show: showOnlyForExecutionLog,
		},
		default: {},
		options: [
			{
				displayName: 'Actor ID',
				name: 'actorId',
				type: 'string',
				default: '',
				description: 'Agent or user performing the action',
				routing: {
					send: {
						type: 'body',
						property: 'actorId',
					},
				},
			},
			{
				displayName: 'Callback URL',
				name: 'callbackUrl',
				type: 'string',
				default: '',
				description: 'Optional URL Tracira should call for gate-mode follow-up',
				routing: {
					send: {
						type: 'body',
						property: 'callbackUrl',
					},
				},
			},
			{
				displayName: 'Confidence',
				name: 'confidence',
				type: 'number',
				default: 0,
				description: 'Optional confidence score between 0 and 1',
				routing: {
					send: {
						type: 'body',
						property: 'confidence',
					},
				},
			},
			{
				displayName: 'Cost (USD)',
				name: 'costUsd',
				type: 'number',
				default: 0,
				description: 'Optional cost of the AI call in USD',
				routing: {
					send: {
						type: 'body',
						property: 'costUsd',
					},
				},
			},
			{
				displayName: 'Execution ID',
				name: 'id',
				type: 'string',
				default: '',
				description: 'Optional custom execution ID for idempotency',
				routing: {
					send: {
						type: 'body',
						property: 'id',
					},
				},
			},
			{
				displayName: 'Latency',
				name: 'latencyMs',
				type: 'number',
				default: 0,
				description: 'Optional AI latency in milliseconds',
				routing: {
					send: {
						type: 'body',
						property: 'latencyMs',
					},
				},
			},
			{
				displayName: 'Metadata JSON',
				name: 'metadataJson',
				type: 'string',
				typeOptions: {
					rows: 4,
				},
				default: '{}',
				description: 'Optional JSON object to store as execution metadata',
				routing: {
					request: {
						body: {
							metadata: '={{$value ? JSON.parse($value) : undefined}}',
						},
					},
				},
			},
			{
				displayName: 'Session ID',
				name: 'sessionId',
				type: 'string',
				default: '',
				description: 'Context identifier for grouping related executions',
				routing: {
					send: {
						type: 'body',
						property: 'sessionId',
					},
				},
			},
			{
				displayName: 'Subject ID',
				name: 'subjectId',
				type: 'string',
				default: '',
				description: 'Entity being acted on, such as a ticket or record ID',
				routing: {
					send: {
						type: 'body',
						property: 'subjectId',
					},
				},
			},
		],
	},
];
