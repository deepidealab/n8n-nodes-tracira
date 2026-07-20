import type {
	IDataObject,
	IHookFunctions,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes } from 'n8n-workflow';
import { traciraApiRequest } from '../Tracira/shared/transport';

export class TraciraTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Tracira Trigger',
		name: 'traciraTrigger',
		icon: { light: 'file:tracira.svg', dark: 'file:tracira.dark.svg' },
		group: ['trigger'],
		version: 1,
		subtitle: 'Watch decisions',
		description:
			'Starts the workflow the moment an output gets a verdict or a human decision in Tracira',
		// A webhook trigger is never actually invoked as an AI-agent tool, but the
		// scanner lints with `allowInlineConfig: false`, so the rule cannot be
		// suppressed by a comment and the type only permits `true`.
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
			alias: ['Tracira AI', 'AI approval', 'human in the loop', 'AI monitoring'],
		},
		defaults: {
			name: 'Tracira Trigger',
		},
		eventTriggerDescription: 'Waiting for a Tracira verdict or decision',
		activationMessage:
			'Your workflow will now start when an output gets a verdict or a human decision in Tracira.',
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'traciraApi',
				required: true,
			},
		],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
			},
		],
		properties: [
			{
				displayName: 'Watch',
				name: 'events',
				type: 'multiOptions',
				required: true,
				default: ['approved', 'rejected', 'changed'],
				options: [
					{ name: 'Approved by a Human', value: 'approved' },
					{ name: 'Edited by a Human', value: 'changed' },
					{ name: 'Evaluation Error', value: 'error' },
					{ name: 'Flagged for Review', value: 'flagged' },
					{ name: 'Passed All Rules', value: 'pass' },
					{ name: 'Rejected by a Human', value: 'rejected' },
					{ name: 'Taken Over by a Human', value: 'handled' },
				],
				description:
					'Which Tracira events start this workflow. The default (approved / rejected / edited) fires once a human has made a decision - the usual choice for approval flows. Decision events include the AI output and its metadata, so the workflow can deliver an approved reply directly. When a reviewer edits an output, output already carries their corrected version, so a workflow that maps output needs no changes; correctedOutput and aiOutput let you tell the cases apart. No setup is needed in Tracira: activating this workflow registers the trigger automatically.',
			},
		],
	};

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const webhookData = this.getWorkflowStaticData('node');
				if (!webhookData.subscriptionId) return false;

				const webhookUrl = this.getNodeWebhookUrl('default');
				let response: { subscriptions?: Array<{ id: string; url: string }> };
				try {
					response = (await traciraApiRequest.call(this, 'GET', '/subscriptions')) as {
						subscriptions?: Array<{ id: string; url: string }>;
					};
				} catch (error) {
					// Wrap HTTP failures in NodeApiError to keep status code and response body.
					throw new NodeApiError(this.getNode(), error as JsonObject);
				}
				return (response.subscriptions ?? []).some(
					(subscription) =>
						subscription.id === webhookData.subscriptionId && subscription.url === webhookUrl,
				);
			},

			async create(this: IHookFunctions): Promise<boolean> {
				const webhookUrl = this.getNodeWebhookUrl('default');
				const events = this.getNodeParameter('events') as string[];

				let response: { id: string };
				try {
					response = (await traciraApiRequest.call(this, 'POST', '/subscriptions', {}, {
						url: webhookUrl,
						events,
						source: 'n8n',
					})) as { id: string };
				} catch (error) {
					// Wrap HTTP failures in NodeApiError to keep status code and response body.
					throw new NodeApiError(this.getNode(), error as JsonObject);
				}

				const webhookData = this.getWorkflowStaticData('node');
				webhookData.subscriptionId = response.id;
				return true;
			},

			async delete(this: IHookFunctions): Promise<boolean> {
				const webhookData = this.getWorkflowStaticData('node');
				if (webhookData.subscriptionId) {
					try {
						await traciraApiRequest.call(
							this,
							'DELETE',
							`/subscriptions/${webhookData.subscriptionId}`,
						);
					} catch (error) {
						// Wrap HTTP failures in NodeApiError to keep status code and response body,
						// consistent with checkExists and create above.
						throw new NodeApiError(this.getNode(), error as JsonObject);
					}
					delete webhookData.subscriptionId;
				}
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const body = this.getBodyData() as IDataObject;
		return {
			workflowData: [this.helpers.returnJsonArray(body)],
		};
	}
}
