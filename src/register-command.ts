import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v10';
import dotenv from 'dotenv';

dotenv.config();

const commands = [
    {
        name: '이슈등록',
        description: '깃허브 이슈를 생성합니다.',
        options: [
            {
                name: '제목',
                description: '이슈 제목',
                type: 3, // STRING
                required: true,
            },
        ],
    },
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);

(async () => {
    try {
        console.log('📡 명령어 등록 중...');
        await rest.put(
            Routes.applicationCommands(process.env.DISCORD_CLIENT_ID!),
            { body: commands }
        );
        console.log('✅ 등록 완료!');
    } catch (error) {
        console.error('❌ 등록 실패:', error);
    }
})();