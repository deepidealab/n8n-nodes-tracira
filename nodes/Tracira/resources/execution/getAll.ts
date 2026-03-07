import type { INodeProperties } from 'n8n-workflow';

const showOnlyForExecutionGetMany = {
	operation: ['getAll'],
	resource: ['execution'],
};

export const executionGetManyDescription: INodeProperties[] = [
	{
		displayName: 'Status',
		name: 'status',
		type: 'options',
		displayOptions: {
			show: showOnlyForExecutionGetMany,
		},
		options: [
			{ name: 'All', value: '' },
			{ name: 'Success', value: 'success' },
			{ name: 'Flagged', value: 'flagged' },
			{ name: 'Failed', value: 'failed' },
		],
		default: '',
		description: 'Filter executions by status',
		routing: {
			send: {
				type: 'query',
				property: 'status',
			},
		},
	},
	{
		displayName: 'Flow',
		name: 'flowFilter',
		type: 'resourceLocator',
		displayOptions: {
			show: showOnlyForExecutionGetMany,
		},
		default: { mode: 'list', value: '' },
		description: 'Filter executions to a specific flow',
		modes: [
			{
				displayName: 'Flow',
				name: 'list',
				type: 'list',
				placeholder: 'Select a flow...',
				typeOptions: {
					searchListMethod: 'getFlows',
					searchable: true,
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
				qs: {
					flow: '={{$value}}',
				},
			},
		},
	},
	{
		displayName: 'Check',
		name: 'checkFilter',
		type: 'resourceLocator',
		displayOptions: {
			show: showOnlyForExecutionGetMany,
		},
		default: { mode: 'list', value: '' },
		description: 'Filter executions to a specific check',
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
				qs: {
					check: '={{$value}}',
				},
			},
		},
	},
	{
		displayName: 'Search Query',
		name: 'query',
		type: 'string',
		displayOptions: {
			show: showOnlyForExecutionGetMany,
		},
		default: '',
		description: 'Search across flow, check, model, and context IDs',
		routing: {
			send: {
				type: 'query',
				property: 'q',
			},
		},
	},
	{
		displayName: 'From',
		name: 'from',
		type: 'dateTime',
		displayOptions: {
			show: showOnlyForExecutionGetMany,
		},
		default: '',
		description: 'Only include executions at or after this date',
		routing: {
			send: {
				type: 'query',
				property: 'from',
			},
		},
	},
	{
		displayName: 'To',
		name: 'to',
		type: 'dateTime',
		displayOptions: {
			show: showOnlyForExecutionGetMany,
		},
		default: '',
		description: 'Only include executions up to this date',
		routing: {
			send: {
				type: 'query',
				property: 'to',
			},
		},
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		displayOptions: {
			show: showOnlyForExecutionGetMany,
		},
		typeOptions: {
			minValue: 1,
			maxValue: 100,
		},
		default: 50,
		description: 'Max number of results to return',
		routing: {
			send: {
				type: 'query',
				property: 'limit',
			},
			output: {
				maxResults: '={{$value}}',
			},
		},
	},
	{
		displayName: 'Page',
		name: 'page',
		type: 'number',
		displayOptions: {
			show: showOnlyForExecutionGetMany,
		},
		typeOptions: {
			minValue: 1,
		},
		default: 1,
		description: 'Results page number',
		routing: {
			send: {
				type: 'query',
				property: 'page',
			},
		},
	},
	{
		displayName: 'Additional Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		displayOptions: {
			show: showOnlyForExecutionGetMany,
		},
		default: {},
		options: [
			{
				displayName: 'Actor ID',
				name: 'actorId',
				type: 'string',
				default: '',
				description: 'Filter by actor ID',
				routing: {
					send: {
						type: 'query',
						property: 'actorId',
					},
				},
			},
			{
				displayName: 'Session ID',
				name: 'sessionId',
				type: 'string',
				default: '',
				description: 'Filter by session ID',
				routing: {
					send: {
						type: 'query',
						property: 'sessionId',
					},
				},
			},
			{
				displayName: 'Subject ID',
				name: 'subjectId',
				type: 'string',
				default: '',
				description: 'Filter by subject ID',
				routing: {
					send: {
						type: 'query',
						property: 'subjectId',
					},
				},
			},
		],
	},
];
