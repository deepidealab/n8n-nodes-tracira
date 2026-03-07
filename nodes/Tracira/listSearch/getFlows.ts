import type {
	ILoadOptionsFunctions,
	INodeListSearchItems,
	INodeListSearchResult,
} from 'n8n-workflow';
import { traciraApiRequest } from '../shared/transport';

type Flow = {
	id: string;
	name: string;
	icon?: string;
};

export async function getFlows(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodeListSearchResult> {
	const responseData = (await traciraApiRequest.call(this, 'GET', '/flows')) as Flow[];
	const normalizedFilter = (filter ?? '').trim().toLowerCase();

	const results: INodeListSearchItems[] = responseData
		.filter((flow) => !normalizedFilter || flow.name.toLowerCase().includes(normalizedFilter))
		.map((flow) => ({
			name: flow.name,
			value: flow.name,
		}));

	return { results };
}
