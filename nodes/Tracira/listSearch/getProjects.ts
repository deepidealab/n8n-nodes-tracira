import type {
	ILoadOptionsFunctions,
	INodeListSearchItems,
	INodeListSearchResult,
} from 'n8n-workflow';
import { traciraApiRequest } from '../shared/transport';

type Project = {
	id: string;
	name: string;
	icon?: string;
};

export async function getProjects(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodeListSearchResult> {
	const responseData = (await traciraApiRequest.call(this, 'GET', '/projects')) as Project[];
	const normalizedFilter = (filter ?? '').trim().toLowerCase();

	const results: INodeListSearchItems[] = responseData
		.filter(
			(project) => !normalizedFilter || project.name.toLowerCase().includes(normalizedFilter),
		)
		.map((project) => ({
			name: project.name,
			value: project.name,
		}));

	return { results };
}
