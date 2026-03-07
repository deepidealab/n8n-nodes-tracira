import type {
	ILoadOptionsFunctions,
	INodeListSearchItems,
	INodeListSearchResult,
} from 'n8n-workflow';
import { traciraApiRequest } from '../shared/transport';

export async function getChecks(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodeListSearchResult> {
	const flowName =
		(this.getCurrentNodeParameter('flowName', { extractValue: true }) as string | undefined) ??
		(this.getCurrentNodeParameter('flowFilter', { extractValue: true }) as string | undefined) ??
		'';

	const responseData = (await traciraApiRequest.call(this, 'GET', '/executions/checks', flowName ? { flow: flowName } : {})) as string[];
	const normalizedFilter = (filter ?? '').trim().toLowerCase();

	const results: INodeListSearchItems[] = responseData
		.filter((check) => !normalizedFilter || check.toLowerCase().includes(normalizedFilter))
		.map((check) => ({
			name: check,
			value: check,
		}));

	return { results };
}
