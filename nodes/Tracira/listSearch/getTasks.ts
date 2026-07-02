import type {
	ILoadOptionsFunctions,
	INodeListSearchItems,
	INodeListSearchResult,
} from 'n8n-workflow';
import { traciraApiRequest } from '../shared/transport';

export async function getTasks(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodeListSearchResult> {
	const project =
		(this.getCurrentNodeParameter('projectName', { extractValue: true }) as string | undefined) ??
		(this.getCurrentNodeParameter('projectFilter', { extractValue: true }) as string | undefined) ??
		'';

	const responseData = (await traciraApiRequest.call(
		this,
		'GET',
		'/logs/tasks',
		project ? { project } : {},
	)) as string[];
	const normalizedFilter = (filter ?? '').trim().toLowerCase();

	const results: INodeListSearchItems[] = responseData
		.filter((task) => !normalizedFilter || task.toLowerCase().includes(normalizedFilter))
		.map((task) => ({
			name: task,
			value: task,
		}));

	return { results };
}
