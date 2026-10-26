export interface PluginMeta {
	name: string;
	version: { name: string; code: number };
	image?: string | null;
	permissions?: string[];
	features?: string[];
	homepage?: string | null;
	source?: string | null;
	issues?: string | null;
	autoUpdater?: { source: string; params?: Record<string, string> } | null;
}

export type PluginFeature =
	| "metadata.search"
	| "metadata.get.movie"
	| "metadata.get.tv"
	| "metadata.get.season"
	| "metadata.get.tv.seasons"
	| "metadata.get.episode";

export interface PluginMethod {
	id: string;
	feature: PluginFeature;
	label: string;
	description: string;
	params: MethodParamDef[];
}

export interface MethodParamDef {
	key: string;
	label: string;
	type: "text" | "pick" | "number";
	options?: string[];
	required?: boolean;
	placeholder?: string;
}

export const METHOD_REGISTRY: Record<PluginFeature, PluginMethod> = {
	"metadata.search": {
		id: "metadata.search",
		feature: "metadata.search",
		label: "Search",
		description: "Search for media by title",
		params: [
			{
				key: "type",
				label: "Type",
				type: "pick",
				options: ["Movie", "Tv"],
				required: true,
			},
			{
				key: "query",
				label: "Query",
				type: "text",
				required: true,
				placeholder: "Query",
			},
			{
				key: "year",
				label: "Year",
				type: "number",
				required: true,
				placeholder: "Year",
			},
		],
	},
	"metadata.get.movie": {
		id: "metadata.getMovie",
		feature: "metadata.get.movie",
		label: "Get Movie",
		description: "Fetch metadata for a movie by ID",
		params: [
			{
				key: "id",
				label: "ID",
				type: "text",
				required: true,
				placeholder: "e.g. 12345",
			},
		],
	},
	"metadata.get.tv": {
		id: "metadata.getTv",
		feature: "metadata.get.tv",
		label: "Get TV Show",
		description: "Fetch metadata for a TV show by ID",
		params: [
			{
				key: "id",
				label: "ID",
				type: "text",
				required: true,
				placeholder: "e.g. 12345",
			},
		],
	},
	"metadata.get.tv.seasons": {
		id: "metadata.getSeasons",
		feature: "metadata.get.tv.seasons",
		label: "Get TV Seasons",
		description: "List all seasons of a TV show by ID",
		params: [
			{
				key: "id",
				label: "ID",
				type: "text",
				required: true,
				placeholder: "e.g. 12345",
			},
		],
	},
	"metadata.get.season": {
		id: "metadata.getSeason",
		feature: "metadata.get.season",
		label: "Get Season",
		description: "Fetch metadata for a season by ID",
		params: [
			{
				key: "id",
				label: "ID",
				type: "text",
				required: true,
				placeholder: "e.g. 12345",
			},
			{
				key: "season",
				label: "Season",
				type: "text",
				required: true,
				placeholder: "e.g. 1",
			},
		],
	},
	"metadata.get.episode": {
		id: "metadata.getEpisode",
		feature: "metadata.get.episode",
		label: "Get Episode",
		description:
			"Fetch metadata for an episode by show ID, season, and episode index",
		params: [
			{
				key: "id",
				label: "ID",
				type: "text",
				required: true,
				placeholder: "e.g. 12345",
			},
			{
				key: "season",
				label: "Season",
				type: "number",
				required: true,
				placeholder: "e.g. 1",
			},
			{
				key: "episode",
				label: "Episode",
				type: "number",
				required: true,
				placeholder: "e.g. 1",
			},
		],
	},
};

export type Result =
	| SearchResult
	| MetadataResult
	| SeasonsListResult
	| EpisodeMetadataResult
	| SeasonMetadataResult
	| ErrorResult;

export interface SearchResult {
	kind: "search";
	type?: string;
	items: SearchItem[];
}

export interface SearchItem {
	id: string;
	titles: string[];
	poster?: string;
	year?: number | null;
}

export interface MetadataResult {
	kind: "metadata";
	title: string;
	titleTranslations?: Record<string, string>;
	tagline?: string;
	taglineTranslations?: Record<string, string>;
	description?: string;
	descriptionTranslations?: Record<string, string>;
	images?: {
		poster?: MetadataImage[];
		banner?: MetadataImage[];
		logo?: MetadataImage[];
		backdrop?: MetadataImage[];
		thumbnail?: MetadataImage[];
	};
	releaseDate?: string;
	finishDate?: string;
	ageRatings?: Record<string, string>;
}

export interface EpisodeMetadataResult {
	kind: "episodeMetadata";
	title: string;
	titleTranslations?: Record<string, string>;
	summary: string;
	summaryTranslations?: Record<string, string>;
	thumbnails?: MetadataImage[];
	releaseDate?: string;
}

export interface SeasonMetadataResult {
	kind: "seasonMetadata";
	title: string;
	titleTranslations?: Record<string, string>;
	description: string;
	descriptionTranslations?: Record<string, string>;
	posters?: MetadataImage[];
}

export interface MetadataImage {
	url: string;
	locale?: string;
	score?: number;
}

export interface SeasonsListResult {
	kind: "seasonList";
	items: Season[];
}

export interface Season {
	id: string;
	index: number;
	name: string;
	posters: MetadataImage[];
}

export interface ErrorResult {
	kind: "error";
	message: string;
	raw?: string;
}

export type WebviewMessage =
	| { type: "submit"; method: string; params: Record<string, string> }
	| { type: "selectResult"; id: string; method: string }
	| { type: "cancel" };

export type ExtensionMessage =
	| { type: "init"; methodHtml: string; resultHtml: string }
	| { type: "setMethod"; html: string }
	| { type: "setLoading"; html: string }
	| { type: "setResult"; html: string }
	| { type: "prefill"; name: string; value: string };
