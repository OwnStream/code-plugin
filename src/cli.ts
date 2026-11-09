import { spawn, ChildProcess } from "child_process";
import { state } from "./state";
import { getCliPath } from "./settings";
import { Result, PluginFeature } from "./types";
import { log, logSection } from "./output";

let activeProcess: ChildProcess | null = null;

export async function runMethod(
	methodId: PluginFeature,
	params: Record<string, string>,
): Promise<Result> {
	const cliPath = getCliPath();

	if (!state.pluginFolder) {
		return { kind: "error", message: "No plugin folder selected" };
	}

	cancelActive();
	state.setRunning(true);

	const args = [
		"--json",
		"--project",
		state.pluginFolder!,
		"run",
		methodId,
		...Object.entries(params).flatMap(([k, v]) => [`--${k}`, v]),
	];

	logSection(`Running: ${cliPath} ${args.join(" ")}`);

	return new Promise<Result>((resolve) => {
		activeProcess = spawn(cliPath, args, {
			stdio: ["ignore", "pipe", "pipe"],
		});

		let stdout = "";
		let stderr = "";

		activeProcess.stdout!.on("data", (chunk: Buffer) => {
			stdout += chunk.toString();
		});

		activeProcess.stderr!.on("data", (chunk: Buffer) => {
			stderr += chunk.toString();
		});

		activeProcess.on("close", (code) => {
			activeProcess = null;

			if (stderr) {
				log(`[stderr] ${stderr}`);
			}

			if (code !== 0) {
				log(`[exit ${code}] ${stdout || "(no output)"}`);
				const result: Result = {
					kind: "error",
					message: `CLI exited with code ${code}`,
					raw: stderr || stdout,
				};
				state.setResult(result);
				resolve(result);
				return;
			}

			if (stdout.startsWith("[JS]")) {
				log(stdout);
				return;
			}

			log(`[stdout] ${stdout}`);

			try {
				const parsed = JSON.parse(stdout);
				if (parsed.success === false) {
					const result: Result = {
						kind: "error",
						message:
							parsed.error?.message ?? "Plugin returned an error",
						raw: JSON.stringify(parsed, null, 2),
					};
					state.setResult(result);
					resolve(result);
					return;
				}
				const result = normalizeResult(methodId, parsed.result, params);
				state.setResult(result);
				resolve(result);
			} catch {
				const result: Result = {
					kind: "error",
					message: "Failed to parse CLI output",
					raw: stdout,
				};
				state.setResult(result);
				resolve(result);
			}
		});

		activeProcess.on("error", (err) => {
			activeProcess = null;
			log(`[error] ${err.message}`);
			const result: Result = {
				kind: "error",
				message: `Failed to spawn CLI: ${err.message}`,
			};
			state.setResult(result);
			resolve(result);
		});
	});
}

function normalizeResult(
	feature: PluginFeature,
	raw: any,
	params: Record<string, string>,
): Result {
	if (feature === "metadata.search" && Array.isArray(raw)) {
		return {
			kind: "search",
			type: params.type,
			items: raw.map((item: any) => ({
				id: item.id ?? "",
				titles: item.titles ?? [],
				poster: item.poster,
				year: item.year,
			})),
		};
	}

	if (
		feature === "metadata.getMovie" ||
		feature === "metadata.getTv"
	) {
		return {
			kind: "metadata",
			title: raw.title ?? "",
			titleTranslations: raw.titleTranslations,
			tagline: raw.tagline,
			taglineTranslations: raw.taglineTranslations,
			description: raw.description,
			descriptionTranslations: raw.descriptionTranslations,
			images: raw.images,
			releaseDate: raw.releaseDate,
			finishDate: raw.finishDate,
			ageRatings: raw.ageRatings,
		};
	}

	if (feature === "metadata.getTvEpisode") {
		return {
			kind: "episodeMetadata",
			title: raw.title ?? "",
			titleTranslations: raw.titleTranslations,
			summary: raw.summary,
			summaryTranslations: raw.summaryTranslations,
			thumbnails: raw.thumbnails,
		};
	}

	if (feature === "metadata.getTvSeason") {
		return {
			kind: "seasonMetadata",
			title: raw.title ?? "",
			titleTranslations: raw.titleTranslations,
			description: raw.description,
			descriptionTranslations: raw.descriptionTranslations,
			posters: raw.posters,
		};
	}

	if (feature === "metadata.getTvSeasons") {
		return {
			kind: "seasonList",
			contentId: params.id,
			items: raw,
		};
	}

	return {
		kind: "metadata",
		title: raw.title ?? JSON.stringify(raw),
	};
}

export function cancelActive() {
	if (activeProcess) {
		activeProcess.kill("SIGTERM");
		activeProcess = null;
	}
}
