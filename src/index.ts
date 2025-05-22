import express from 'express';
import { verifyKeyMiddleware, InteractionType, InteractionResponseType } from 'discord-interactions';
import { Octokit } from '@octokit/rest';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

app.use(express.json());

async function createGithubIssue(title: string) {
    await octokit.issues.create({
        owner: process.env.GITHUB_OWNER!,
        repo: process.env.GITHUB_REPO!,
        title,
    });
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
                    console.log('📝 이슈 제목:', title);

                    try {
                        await createGithubIssue(title);

                        return res.send({
                            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                            data: {
                                content: `✅ GitHub 이슈 생성 완료: ${title}`,
                            },
                        });
                    } catch (err) {
                        console.error('❌ GitHub 이슈 생성 실패:', err);
                        return res.send({
                            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                            data: {
                                content: `❌ GitHub 이슈 생성 중 오류가 발생했습니다.`,
                            },
                        });
                    }
                }

                res.status(400).send('Unrecognized interaction');
            } catch (err) {
                next(err);
            }
        })();
    }
);

app.listen(3000, () => {
    console.log('🚀 Server running at http://localhost:3000');
});