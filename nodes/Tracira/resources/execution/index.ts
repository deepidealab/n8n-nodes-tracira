import type { INodeProperties } from 'n8n-workflow';
import { executionGetDescription } from './get';
import { executionGetManyDescription } from './getAll';
import { executionLogDescription } from './log';

const showOnlyForExecutions = {
	resource: ['execution'],
};

export const executionDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: showOnlyForExecutions,
		},
		options: [
			{
				name: 'Log',
				value: 'log',
				action: 'Log an execution',
				description: 'Send an AI execution to Tracira for evaluation',
				routing: {
					request: {
						method: 'POST',
						url: '/webhook',
					},
				},
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get an execution',
				description: 'Fetch a single execution by ID',
				routing: {
					request: {
						method: 'GET',
						url: '=/executions/{{$parameter.executionId}}',
					},
				},
			},
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many executions',
				description: 'List executions from Tracira',
				routing: {
					request: {
						method: 'GET',
						url: '/executions',
					},
					output: {
						postReceive: [
							{
								type: 'rootProperty',
								properties: {
									property: 'executions',
								},
							},
						],
					},
				},
			},
		],
		default: 'log',
	},
	...executionLogDescription,
	...executionGetDescription,
	...executionGetManyDescription,
];
