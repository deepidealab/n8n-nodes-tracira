import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	Icon,
	INodeProperties,
} from 'n8n-workflow';

export class TraciraApi implements ICredentialType {
	name = 'traciraApi';

	displayName = 'Tracira API';

	icon: Icon = { light: 'file:../nodes/Tracira/tracira.svg', dark: 'file:../nodes/Tracira/tracira.dark.svg' };

	documentationUrl = 'https://github.com/deepidealab/n8n-nodes-tracira?tab=readme-ov-file#credentials';

	properties: INodeProperties[] = [
		{
			displayName: 'Workspace Token',
			name: 'webhookToken',
			type: 'string',
			typeOptions: { password: true },
			required: true,
			default: '',
			description: 'The webhook token from your Tracira workspace',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			qs: {
				token: '={{$credentials.webhookToken}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://www.tracira.com/api',
			url: '/verify',
			method: 'GET',
		},
	};
}
