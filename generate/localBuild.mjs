import transcribeFunction from './transcribe.mjs';
import path from 'path';
import { exec } from 'child_process';
import { postVideo } from './postVideo.mjs';
import { topics } from './topics.mjs';
import { rm, mkdir, unlink } from 'fs/promises';
import Groq from 'groq-sdk/index.mjs';
import { random } from 'remotion';

export const PROCESS_ID = 0;


const groq = new Groq({
	apiKey: process.env.GROQ_API_KEY,
});


async function cleanupResources() {
	try {
		await rm(path.join('public', 'srt'), { recursive: true, force: true });
		await rm(path.join('public', 'voice'), { recursive: true, force: true });
		await unlink(path.join('public', `audio-${PROCESS_ID}.mp3`)).catch((e) =>
			console.error(e)
		);
		await unlink(path.join('src', 'tmp', 'context.tsx')).catch((e) =>
			console.error(e)
		);
		await mkdir(path.join('public', 'srt'), { recursive: true });
		await mkdir(path.join('public', 'voice'), { recursive: true });
	} catch (err) {
		console.error(`Error during cleanup: ${err}`);
	}
}

const agents = [
	'BARACK_OBAMA',
	'BEN_SHAPIRO',
	'JORDAN_PETERSON',
	'JOE_ROGAN',
	// 'DONALD_TRUMP',
	// 'RICK_SANCHEZ',
];

const backgrounds = [
	'MINECRAFT',
	'GTA',

]

const musics = [
	'FLUFFING_A_DUCK',
	'MONKEYS_SPINNING_MONKEYS',
	'WII_SHOP_CHANNEL_TRAP'
]

const local = true;

async function main() {
	if (topics.length == 0) {
		await generateTopics();
	}
	const videoTopic = topics.pop();
	let agentAIndex = Math.floor(Math.random() * agents.length);
	let agentBIndex;
	do {
		agentBIndex = Math.floor(Math.random() * agents.length);
	} while (agentAIndex === agentBIndex);
	const agentA = agents[agentAIndex];
	const agentB = agents[agentBIndex];

	const aiGeneratedImages = true;
	const fps = 30;
	const duration = 1; //minute
	//MINECRAFT or TRUCK or GTA
	const background = backgrounds[Math.floor(Math.random() * backgrounds.length)];
	const music = musics[Math.floor(Math.random() * musics.length)];
	const cleanSrt = true;

	await transcribeFunction(
		local,
		videoTopic['topic'],
		agentA,
		agentB,
		aiGeneratedImages,
		fps,
		duration,
		background,
		music,
		cleanSrt,
	);

	const videoID = "" + Math.floor(Math.random() * 100000000);

	// run in the command line `npm run build`
	exec(`npm run build out/${videoID}.mp4`, async (error, stdout, stderr) => {
		if (error) {
			console.error(`exec error: ${error}`);
			return;
		}
		console.log(`stdout: ${stdout}`);
		console.error(`stderr: ${stderr}`);

		cleanupResources();
		postVideo(videoID, videoTopic['title']);
	});
}

async function generateTopics() {
	const completion = await groq.chat.completions.create({
		messages: [
			{
				role: 'system',
				content: 'Generate a JSON object of completely random ideas for interesting educational conversation topics in the form of {"title of idea":"detailed one-sentence explanation of idea"}',
			}
		],
		response_format: { type: 'json_object' },
		model: 'llama3-70b-8192',
		temperature: 0.5, //temperatures above 1 sometimes fail to generate a valid JSON object
		max_tokens: 4096,
		top_p: 1,
		stop: null,
		stream: false,
	});
	const content = JSON.parse(completion.choices[0]?.message?.content || '');
	Object.keys(content).forEach(element => {
		topics.push({
			'title': element,
			'topic': content[element]
		});
	});
}

(async () => {
	await main();
})();
