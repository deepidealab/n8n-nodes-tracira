/* eslint-disable @n8n/community-nodes/node-usable-as-tool */
import type { INodeType, INodeTypeDescription } from 'n8n-workflow';
import { executionDescription } from './resources/execution';
import { getChecks } from './listSearch/getChecks';
import { getFlows } from './listSearch/getFlows';
import { getModels } from './listSearch/getModels';

export class Tracira implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Tracira',
		name: 'tracira',
		icon: 'file:tracira.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Log and inspect Tracira AI execution data',
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
		requestDefaults: {
			baseURL: 'https://www.tracira.com/api',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
			},
		},
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
			...executionDescription,
		],
	};

	methods = {
		listSearch: {
			getChecks,
			getFlows,
			getModels,
		},
	};
}
