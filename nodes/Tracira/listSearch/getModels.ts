import type {
	ILoadOptionsFunctions,
	INodeListSearchItems,
	INodeListSearchResult,
} from 'n8n-workflow';
import { traciraApiRequest } from '../shared/transport';

type ModelOption = {
	label: string;
	value: string;
};

export async function getModels(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodeListSearchResult> {
	const responseData = (await traciraApiRequest.call(this, 'GET', '/models')) as ModelOption[];
	const normalizedFilter = (filter ?? '').trim().toLowerCase();

	const results: INodeListSearchItems[] = responseData
		.filter(
			(model) =>
				!normalizedFilter ||
				model.label.toLowerCase().includes(normalizedFilter) ||
				model.value.toLowerCase().includes(normalizedFilter),
		)
		.map((model) => ({
			name: model.label,
			value: model.value,
		}));

	return { results };
}
