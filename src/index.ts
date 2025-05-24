import express from 'express';
import { config } from 'dotenv';
import {
    verifyKeyMiddleware,
    InteractionType,
    InteractionResponseType,
} from 'discord-interactions';
import { Octokit } from '@octokit/rest';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v10';

config();

const app = express();
app.use(express.json());

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);

// GitHub 이슈 생성
async function createGithubIssue(title: string) {
    const { data } = await octokit.issues.create({
        owner: process.env.GITHUB_OWNER!,
        repo: process.env.GITHUB_REPO!,
        title,
    });
    return data.html_url;
}

// Discord에 메시지 전송
async function sendIssueMessage(channelId: string, title: string) {
    const response = await rest.post(
        Routes.channelMessages(channelId),
        {
            body: {
                content: `📝 GitHub 이슈를 생성 중입니다: **${title}**`,
            },
        }
    ) as any;
    return response.id;
}

// 스레드 생성
async function createThread(channelId: string, messageId: string, title: string) {
    const response = await rest.post(
        `/channels/${channelId}/messages/${messageId}/threads`,
        {
            body: {
                name: `이슈: ${title}`,
                auto_archive_duration: 60,
            },
        }
    ) as any;
    return response.id;
}

// 스레드에 메시지 전송
async function sendMessageToThread(threadId: string, content: string) {
    await rest.post(
        `/channels/${threadId}/messages`,
        {
            body: { content },
        }
    );
}

app.post(
    '/interactions',
    verifyKeyMiddleware(process.env.DISCORD_PUBLIC_KEY!),
    (req, res, next) => {
        (async () => {
            try {
                const { type } = req.body;

                if (type === InteractionType.PING) {
                    console.log('✅ PING 요청 수신!');
                    return res.send({ type: InteractionResponseType.PONG });
                }

                if (type === InteractionType.APPLICATION_COMMAND) {
                    const title = req.body.data.options[0].value;
                    const channelId = req.body.channel.id;

                    // 응답 예약: 유저에게 "작업 중" 안내
                    res.send({
                        type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
                    });

                    try {
                        // 메시지 → 스레드 → GitHub 이슈 → 스레드에 링크
                        const messageId = await sendIssueMessage(channelId, title);
                        const threadId = await createThread(channelId, messageId, title);
                        const issueUrl = await createGithubIssue(title);
                        await sendMessageToThread(threadId, `✅ 이슈 생성 완료!\n🔗 ${issueUrl}`);

                        console.log(`🧵 스레드(${threadId})에 이슈 링크 전송 완료`);
                    } catch (err) {
                        console.error('❌ 처리 실패:', err);
                        await rest.post(
                            Routes.channelMessages(channelId),
                            {
                                body: { content: '❌ 이슈 생성 중 오류가 발생했습니다.' },
                            }
                        );
                    }
                } else {
                    res.status(400).send('Unrecognized interaction');
                }
            } catch (err) {
                next(err);
            }
        })();
    }
);

app.listen(3000, () => {
    console.log('🚀 Server running at http://localhost:3000');
});