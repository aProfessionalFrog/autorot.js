import transcribeFunction from './transcribe.mjs';
import path from 'path';
import { exec } from 'child_process';
import { topics } from './topics.mjs';
import { rm, mkdir, unlink } from 'fs/promises';
import Groq from 'groq-sdk/index.mjs';

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

const local = true;

async function main() {
	/* const videoTopic = await fetch('http://127.0.0.1:11434/api/generate', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: {
			'model': 'qwen:0.5b',
			'prompt': 'Write one topic that could be talked about for one minute in the form of a JSON object, in the format "topic": "the idea that you have"',
			'stream': false
		}
	}); */
	if (topics.length == 0) {
		await generateTopics();
	}
	const videoTopic = topics[topics.pop()];
	let agentAIndex = Math.floor(Math.random() * agents.length);
	let agentBIndex;
	do {
		agentBIndex = Math.floor(Math.random() * agents.length);
	} while (agentAIndex === agentBIndex);
	const agentA = agents[agentAIndex];
	const agentB = agents[agentBIndex];

	const aiGeneratedImages = true;
	const fps = 60;
	const duration = 1; //minute
	//MINECRAFT or TRUCK or GTA
	const background = backgrounds[Math.floor(Math.random() * backgrounds.length)];
	const music = 'NONE';
	const cleanSrt = true;

	await transcribeFunction(
		local,
		videoTopic ? videoTopic : randomTopic,
		agentA,
		agentB,
		aiGeneratedImages,
		fps,
		duration,
		background,
		music,
		cleanSrt
	);

	// run in the command line `npm run build`
	exec('npm run build', async (error, stdout, stderr) => {
		if (error) {
			console.error(`exec error: ${error}`);
			return;
		}
		console.log(`stdout: ${stdout}`);
		console.error(`stderr: ${stderr}`);

		cleanupResources();
	});
}

async function generateTopics() {
	const completion = await groq.chat.completions.create({
		messages: [
			{
				role: 'system',
				content: 'Generate a JSON array of completely random ideas for interesting educational conversation topics.',
			}
		],
		response_format: { type: 'json_object' },
		model: 'llama3-70b-8192',
		temperature: 0.5,
		max_tokens: 4096,
		top_p: 1,
		stop: null,
		stream: false,
	});

	const content = completion.choices[0]?.message?.content || '';
	console.log(content);
	completion.choices[0]?.message?.content.forEach(element => {
		topics.push(element);
	});
}

(async () => {
	await main();
})();
