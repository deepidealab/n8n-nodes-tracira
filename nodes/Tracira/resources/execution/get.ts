import type { INodeProperties } from 'n8n-workflow';

const showOnlyForExecutionGet = {
	operation: ['get'],
	resource: ['execution'],
};

export const executionGetDescription: INodeProperties[] = [
	{
		displayName: 'Execution ID',
		name: 'executionId',
		type: 'string',
		displayOptions: {
			show: showOnlyForExecutionGet,
		},
		default: '',
		required: true,
		description: 'The execution ID to retrieve',
	},
];
