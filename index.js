const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const https = require('https');
const RPC = require('discord-rpc');
const { match } = require('assert');
const clientId = '1124974303222435851';

RPC.register(clientId, { debug: true });

const rpc = new RPC.Client({ transport: 'ipc' });

rpc.on('ready', () => {
console.log('RPC is ready');

});

rpc.login({ clientId }).catch(console.error);

function setActivity(details, state, largeImageKey, smallImageKey) {
    if (smallImageKey) {
        rpc.setActivity({
            details: details || 'Playing Valorant',
            state: state || 'In Lobby',
            startTimestamp: Date.now(),
            largeImageKey: largeImageKey || 'valorant-logo',
            smallImageKey: smallImageKey || 'valorant-logo',
            instance: true,
        });
    } else {
        rpc.setActivity({
            details: details || 'Playing Valorant',
            state: state || 'In Lobby',
            startTimestamp: Date.now(),
            largeImageKey: largeImageKey || 'valorant-logo',
            instance: true,
        });
    }
}

const localAgent = new https.Agent({
    rejectUnauthorized: false
});

async function asyncTimeout(delay) {
    return new Promise(resolve => {
        setTimeout(resolve, delay);
    });
}

async function getLockfileData() {
    const lockfilePath = path.join(process.env['LOCALAPPDATA'], 'Riot Games\\Riot Client\\Config\\lockfile');
    const contents = await fs.promises.readFile(lockfilePath, 'utf8');
    let d = {};
    [d.name, d.pid, d.port, d.password, d.protocol] = contents.split(':');
    return d;
}

async function getSession(port, password) {
    return (await fetch(`https://127.0.0.1:${port}/chat/v1/session`, {
        headers: {
            'Authorization': 'Basic ' + Buffer.from(`riot:${password}`).toString('base64')
        },
        agent: localAgent
    })).json();
}

async function getTokens(port, password) {
    return (await fetch(`https://127.0.0.1:${port}/entitlements/v1/token`, {
        headers: {
            'Authorization': 'Basic ' + Buffer.from(`riot:${password}`).toString('base64')
        },
        agent: localAgent
    })).json();
}

async function getHelp(port, password) {
    return (await fetch(`https://127.0.0.1:${port}/help`, {
        headers: {
            'Authorization': 'Basic ' + Buffer.from(`riot:${password}`).toString('base64')
        },
        agent: localAgent
    })).json();
}

async function getChatInfo(password, port) {
    return (await fetch(`https://127.0.0.1:${port}/chat/v6/messages`, {
        headers: {
            'Authorization': 'Basic ' + Buffer.from(`riot:${password}`).toString('base64')
        },
        agent: localAgent
    })).json();
    }
    
async function postMessage(player, type, text, password, port) {
    return (await fetch(`https://127.0.0.1:${port}/chat/v6/messages`, {
        method: 'POST',
        headers: {
            'Authorization': 'Basic ' + Buffer.from(`riot:${password}`).toString('base64'),
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            type: type,
            cid: player,
            message: text
        }),
        agent: localAgent
    })).json();
    
}

async function waitForLockfile() {
    return new Promise(async (resolve, reject) => {
        const watcher = fs.watch(path.join(process.env['LOCALAPPDATA'], 'Riot Games\\Riot Client\\Config\\'), (eventType, fileName) => {
            if (eventType === 'rename' && fileName === 'lockfile') {
                watcher.close();
                resolve();
            }
        });
    });
}

async function fetchMatchState(matchId, tokenData, sessionData) {
    try {
        const response = await fetch(`https://glz-eu-1.eu.a.pvp.net/core-game/v1/matches/${matchId}`, {
            headers: {
                'Authorization': `Bearer ${tokenData.accessToken}`,
                'X-Riot-Entitlements-JWT': tokenData.token,
            }
        });
        if(response.status !== 404) {
            const data = await response.json();
            return data;
        } else {
            const preGame = await fetch(`https://glz-eu-1.eu.a.pvp.net/pregame/v1/players/${sessionData.puuid}`, {
            headers: {
                'Authorization': `Bearer ${tokenData.accessToken}`,
                'X-Riot-Entitlements-JWT': tokenData.token,
            }
        });

        const preGameData = await preGame.json();
        const preGameId = preGameData.MatchID;

            const response = await fetch(`https://glz-eu-1.eu.a.pvp.net/pregame/v1/matches/${preGameId}`, {
                headers: {
                    'Authorization': `Bearer ${tokenData.accessToken}`,
                    'X-Riot-Entitlements-JWT': tokenData.token,
                }
        })
        const data = await response.json();
        return data;
        }
    } catch (error) {
        console.log('Error fetching match data:', error);
        return null;
    }
}


async function getPlayerState(tokenData, sessionData) {
    try {
        const response = await fetch(`https://glz-eu-1.eu.a.pvp.net/core-game/v1/players/${sessionData.puuid}`, {
            headers: {
                'Authorization': `Bearer ${tokenData.accessToken}`,
                'X-Riot-Entitlements-JWT': tokenData.token,
            }
        });
        const data = await response.json();
        return data;
    } catch (error) {
        console.log('Error fetching player state:', error);
        return null;
    }
}



(async () => {
    let lockData = null;
    do {
        try {
            lockData = await getLockfileData();
        } catch (e) {
            console.log('Waiting for lockfile...');
            await waitForLockfile();
        }
    } while (lockData === null);

    console.log('Got lock data...');

    let sessionData = null;
    let lastRetryMessage = 0;
    do {
        try {
            sessionData = await getSession(lockData.port, lockData.password);
            console.log(sessionData)
            if (!sessionData.loaded) {
                await asyncTimeout(1500);
                sessionData = null;
            }
        } catch (e) {
            const currentTime = new Date().getTime();
            if (currentTime - lastRetryMessage > 1000) {
                console.log('Unable to get session data, retrying...');
                lastRetryMessage = currentTime;
            }
        }
    } while (sessionData === null);

    let tokenData = null;
    do {
        tokenData = await getTokens(lockData.port, lockData.password);
    } while (tokenData === null);

    let helpData = null;
    do {
        helpData = await getHelp(lockData.port, lockData.password);
    } while (helpData === null);

    console.log('Got PUUID...');

    let userData;

    setInterval(async() => {
        userData = await getPlayerState(tokenData, sessionData);
    }, 1000);

    let previousState = ''; // Initialize previous state

setInterval(async () => {
    if (!userData) return;
    const matchData = await fetchMatchState(userData.MatchID, tokenData, sessionData);
    if (matchData.State == 'IN_PROGRESS') {
        let map;
        let mapImageKey;
        switch (matchData.MapID) {
            case '/Game/Maps/Ascent/Ascent':
            map = 'Ascent';
            mapImageKey = 'ascent';
            break;
            case '/Game/Maps/Duality/Duality':
            map = 'Bind';
            mapImageKey = 'bind';
            break;
            case '/Game/Maps/Bonsai/Bonsai':
            map = 'Split';
            mapImageKey = 'split';
            break;
            case '/Game/Maps/Triad/Triad':
            map = 'Haven';
            mapImageKey = 'haven';
            break;
            case '/Game/Maps/Port/Port':
            map = 'Icebox';
            mapImageKey = 'icebox';
            break;
            case '/Game/Maps/Jam/Jam':
            map = 'Lotus';
            mapImageKey = 'lotus';
            break;
            case '/Game/Maps/Pitt/Pitt':
            map = 'Pearl';
            mapImageKey = 'pearl';
            break;
            default:
            map = 'Unknown Map! :(';
            break;
        }
        let gameMode;

        switch (matchData.ModeID) {
            case '/Game/GameModes/Bomb/BombGameMode.BombGameMode_C':
            gameMode = 'Unrated';
            break;
            case '/Game/GameModes/Deathmatch/DeathmatchGameMode.DeathmatchGameMode_C':
            gameMode = 'Deathmatch';
            break;
            case '/Game/GameModes/OneForAll/OneForAllGameMode.OneForAllGameMode_C':
            gameMode = 'One For All';
            break;
            case '/Game/GameModes/Snowball/SnowballGameMode.SnowballGameMode_C':
            gameMode = 'Snowball Fight';
            break;
            case '/Game/GameModes/SpikeRush/SpikeRushGameMode.SpikeRushGameMode_C':
            gameMode = 'Spike Rush';
            break;
            case '/Game/GameModes/Training/TrainingGameMode.TrainingGameMode_C':
            gameMode = 'Training';
            break;
            case '/Game/GameModes/Competitive/CompetitiveGameMode.CompetitiveGameMode_C':
            gameMode = 'Competitive';
            break;
            default:
            gameMode = 'Unknown Mode! :(';
            break;
        }
        const newState = `Playing ${gameMode}`;

        if (previousState !== newState) {
            setActivity(map, newState, 'valorant-logo', mapImageKey);
            console.log('[!] Changed to in game');
            previousState = newState; // Update previous state
        }
    }

    if(matchData.PregameState == 'character_select_active') {
        const newState = 'Picking Agent';

            console.log(matchData.Teams[0].Players)
            setActivity('Agent Select', newState, 'valorant-logo');
            console.log('[!] Changed to picking agent');
            previousState = newState; 
    }

    if (matchData.httpStatus == 404) {
        const newState = 'In Lobby';

        if (previousState !== newState) {
            setActivity(`${sessionData.game_name}#${sessionData.game_tag}`, newState, 'valorant-logo');
            console.log('[!] Changed to in lobby');
            previousState = newState; // Update previous state
        }
    }

}, 10000);

const chatData = await getChatInfo(lockData.password, lockData.port);
const player = chatData.conversations[0].id;
console.log(player)
console.log(await postMessage('c2c527ca-f209-597c-8197-93a56a170d71@ru1.pvp.net', 'chat', 'Hello!', lockData.password, lockData.port))

})();