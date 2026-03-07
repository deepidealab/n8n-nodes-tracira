import { NodeConnectionTypes, type INodeType, type INodeTypeDescription } from 'n8n-workflow';
import { executionDescription } from './resources/execution';
import { getChecks } from './listSearch/getChecks';
import { getFlows } from './listSearch/getFlows';
import { getModels } from './listSearch/getModels';

export class Tracira implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Tracira',
		name: 'tracira',
		icon: { light: 'file:tracira.svg', dark: 'file:tracira.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Log and inspect Tracira AI execution data',
		usableAsTool: true,
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
