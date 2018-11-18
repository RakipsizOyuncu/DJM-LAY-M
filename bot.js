const Discord = require('discord.js');
const client = new Discord.Client();
const ayarlar = require('./ayarlar.json');
const chalk = require('chalk');
const fs = require('fs');
const moment = require('moment');
require('./util/eventLoader')(client);

var prefix = ayarlar.prefix;

const log = message => {
  console.log(`[${moment().format('YYYY-MM-DD HH:mm:ss')}] ${message}`);
};

client.commands = new Discord.Collection();
client.aliases = new Discord.Collection();
fs.readdir('./komutlar/', (err, files) => {
  if (err) console.error(err);
  log(`${files.length} komut yüklenecek.`);
  files.forEach(f => {
    let props = require(`./komutlar/${f}`);
    log(`Yüklenen komut: ${props.help.name}.`);
    client.commands.set(props.help.name, props);
    props.conf.aliases.forEach(alias => {
      client.aliases.set(alias, props.help.name);
    });
  });
});

client.reload = command => {
  return new Promise((resolve, reject) => {
    try {
      delete require.cache[require.resolve(`./komutlar/${command}`)];
      let cmd = require(`./komutlar/${command}`);
      client.commands.delete(command);
      client.aliases.forEach((cmd, alias) => {
        if (cmd === command) client.aliases.delete(alias);
      });
      client.commands.set(command, cmd);
      cmd.conf.aliases.forEach(alias => {
        client.aliases.set(alias, cmd.help.name);
      });
      resolve();
    } catch (e){
      reject(e);
    }
  });
};

// Müzik Komutu // // API KODU DC DE //

const { GOOGLE_API_KEY } = require('./anahtarlar.json');
const YouTube = require('simple-youtube-api');
const queue = new Map();  
const youtube = new YouTube(GOOGLE_API_KEY);
const ytdl = require('ytdl-core');

client.on('message', async msg => {

	if (msg.author.bot) return undefined;
	if (!msg.content.startsWith(prefix)) return undefined;

	const args = msg.content.split(' ');
	const searchString = args.slice(1).join(' ');
	const url = args[1] ? args[1].replace(/<(.+)>/g, '$1') : '';
	const serverQueue = queue.get(msg.guild.id);
	let command = msg.content.toLowerCase().split(' ')[0];
	command = command.slice(prefix.length)

	if (command === 'çal') {
		const voiceChannel = msg.member.voiceChannel;
		if (!voiceChannel) return msg.channel.sendEmbed(new Discord.RichEmbed()
      .setColor('RANDOM')
    .setDescription(' :x: | İlk olarak sesli bir kanala giriş yapmanız gerek.'));
		const permissions = voiceChannel.permissionsFor(msg.client.user);
		if (!permissions.has('CONNECT')) {
			return msg.channel.sendEmbed(new Discord.RichEmbed()
    .setColor('RANDOM')
    .setTitle(' :x: | İlk olarak sesli bir kanala giriş yapmanız gerek.'));
		}
		if (!permissions.has('SPEAK')) {
			 return msg.channel.sendEmbed(new Discord.RichEmbed()
      .setColor('RANDOM')
      .setTitle(' :mute: | Şarkı başlatılamıyor. Lütfen mikrofonumu açınız.'));
        }

		if (url.match(/^https?:\/\/(www.youtube.com|youtube.com)\/playlist(.*)$/)) {
			const playlist = await youtube.getPlaylist(url);
			const videos = await playlist.getVideos();
			for (const video of Object.values(videos)) {
				const video2 = await youtube.getVideoByID(video.id); // eslint-disable-line no-await-in-loop
				await handleVideo(video2, msg, voiceChannel, true); // eslint-disable-line no-await-in-loop
			}
			 return msg.channel.sendEmbed(new Discord.RichEmbed)
      .setTitle(`** :white_check_mark: | Oynatma Listesi: **${playlist.title}** Kuyruğa Eklendi!**`)
		} else {
			try {
				var video = await youtube.getVideo(url);
			} catch (error) {
				try {
					var videos = await youtube.searchVideos(searchString, 10);
					let index = 0;
         
				 msg.channel.sendEmbed(new Discord.RichEmbed()                  
         .setTitle('Kralbot | Şarkı Seçimi')
         .setDescription(`${videos.map(video2 => `**${++index} -** ${video2.title}`).join('\n')}`)
         .setFooter('Lütfen 1-10 arasında bir rakam seçiniz 10 saniye içinde liste iptal edilecektir.')
         .setColor('0x36393E'));
          msg.delete(5000)
					try {
						var response = await msg.channel.awaitMessages(msg2 => msg2.content > 0 && msg2.content < 11, {
							maxMatches: 1,
							time: 10000,
							errors: ['time']
						});
					} catch (err) {
						console.error(err);
						 return msg.channel.sendEmbed(new Discord.RichEmbed()
            .setColor('0x36393E')
            .setDescription(' :x: | **Şarkı Değeri Belirtmediğiniz İçin Seçim İptal Edilmiştir**.'));
                    }
					const videoIndex = parseInt(response.first().content);
					var video = await youtube.getVideoByID(videos[videoIndex - 1].id);
				} catch (err) {
					console.error(err);
					return msg.channel.sendEmbed(new Discord.RichEmbed()
          .setColor('0x36393E')
          .setDescription(' :x: | **Aradaım Fakat Hiç Bir Sonuç Çıkmadı**'));
                }
            }
			return handleVideo(video, msg, voiceChannel);
      
		}
	} else if (command === 'geç') {
		if (!msg.member.voiceChannel) if (!msg.member.voiceChannel) return msg.channel.sendEmbed(new Discord.RichEmbed()
    .setColor('RANDOM')
    .setDescription(' :speaker: | **Lütfen öncelikle sesli bir kanala katılınız**.'));
		if (!serverQueue) return msg.channel.sendEmbed(new Discord.RichEmbed()
     .setColor('RANDOM')
     .setTitle(' :x: | **Hiç Bir Müzik Çalmamakta**'));                                              
		serverQueue.connection.dispatcher.end('**Müziği Geçtim!**');
		return undefined;
	} else if (command === 'durdur') {
		if (!msg.member.voiceChannel) if (!msg.member.voiceChannel) return msg.channel.sendEmbed(new Discord.RichEmbed()
    .setColor('RANDOM')
    .setDescription('** :speaker: | Lütfen öncelikle sesli bir kanala katılınız.**'));
		if (!serverQueue) return msg.channel.sendEmbed(new Discord.RichEmbed()
     .setColor('RANDOM')
     .setTitle(' :speaker: | Hiç Bir Müzik Çalmamakta**'));                                              
		msg.channel.send(`:stop_button: **${serverQueue.songs[0].title}** Adlı Müzik Durduruldu`);
		serverQueue.songs = [];
		serverQueue.connection.dispatcher.end('**Müzik Bitti**');
		return undefined;
	} else if (command === 'ses') {
		if (!msg.member.voiceChannel) if (!msg.member.voiceChannel) return msg.channel.sendEmbed(new Discord.RichEmbed()
    .setColor('RANDOM')
    .setDescription( ' :speaker: **| Lütfen öncelikle sesli bir kanala katılınız.**'));
		if (!serverQueue) return msg.channel.sendEmbed(new Discord.RichEmbed()
     .setColor('RANDOM')
     .setTitle(' :x: | **Hiç Bir Müzik Çalmamakta**'));                                              
		if (!args[1]) return msg.channel.sendEmbed(new Discord.RichEmbed()
   .setTitle(`:loud_sound: Şuanki Ses Seviyesi: **${serverQueue.volume}**`)
    .setColor('RANDOM'))
		serverQueue.volume = args[1];
		serverQueue.connection.dispatcher.setVolumeLogarithmic(args[1] / 5);
		return msg.channel.sendEmbed(new Discord.RichEmbed()
    .setTitle(`:loud_sound: Ses Seviyesi Ayarlanıyor: **${args[1]}**`)
    .setColor('RANDOM'));                             
	} else if (command === 'çalan') {
		if (!serverQueue) return msg.channel.sendEmbed(new Discord.RichEmbed()
    .setTitle(" :mute: | **Çalan Müzik Bulunmamakta**")
    .setColor('RANDOM'));
		return msg.channel.sendEmbed(new Discord.RichEmbed()
    .setColor('RANDOM')
    .setTitle("Kralbot | Çalan")                            
    .addField('Başlık', `[${serverQueue.songs[0].title}](${serverQueue.songs[0].url})`, true)
    .addField("Süre", `${serverQueue.songs[0].durationm}:${serverQueue.songs[0].durations}`, true))
	} else if (command === 'sıra') {
    let index = 0;
		if (!serverQueue) return msg.channel.sendEmbed(new Discord.RichEmbed()
    .setTitle(" :x: | **Sırada Müzik Bulunmamakta**")
    .setColor('RANDOM'));
		  return msg.channel.sendEmbed(new Discord.RichEmbed()
    .setColor('RANDOM')
     .setTitle('Kralbot | Şarkı Kuyruğu')
    .setDescription(`${serverQueue.songs.map(song => `**${++index} -** ${song.title}`).join('\n')}`))
    .addField('Şu anda çalınan: ' + `${serverQueue.songs[0].title}`);
	} else if (command === 'duraklat') {
		if (serverQueue && serverQueue.playing) {
			serverQueue.playing = false;
			serverQueue.connection.dispatcher.pause();
			return msg.channel.sendEmbed(new Discord.RichEmbed()
      .setTitle(" :pause_button: Müzik Senin İçin Durduruldu!")
      .setColor('RANDOM'));
		}
		return msg.channel.send(' :mute: | **Çalan Müzik Bulunmamakta**');
	} else if (command === 'devam') {
		if (serverQueue && !serverQueue.playing) {
			serverQueue.playing = true;
			serverQueue.connection.dispatcher.resume();
			return msg.channel.sendEmbed(new Discord.RichEmbed()
      .setTitle(" :arrow_forward: Müzik Senin İçin Devam Etmekte!**")
      .setColor('RANDOM'));
		}
		return msg.channel.sendEmbed(new Discord.RichEmbed()
    .setTitle("** :mute: | Çalan Müzik Bulunmamakta.**")
    .setColor('RANDOM'));
	}
  

	return undefined;
});

async function handleVideo(video, msg, voiceChannel, playlist = false) {
    const serverQueue = queue.get(msg.guild.id);
    console.log(video);
    const song = {
        id: video.id,
        title: video.title,
        url: `https://www.youtube.com/watch?v=${video.id}`,
    durationh: video.duration.hours,
    durationm: video.duration.minutes,
        durations: video.duration.seconds,
    views: video.views,
    };
	if (!serverQueue) {
		const queueConstruct = {
			textChannel: msg.channel,
			voiceChannel: voiceChannel,
			connection: null,
			songs: [],
			volume: 5,
			playing: true
		};
		queue.set(msg.guild.id, queueConstruct);

		queueConstruct.songs.push(song);

		try {
			var connection = await voiceChannel.join();
			queueConstruct.connection = connection;
			play(msg.guild, queueConstruct.songs[0]);
		} catch (error) {
			console.error(`<:basarisiz:474973245477486612> **Şarkı Sisteminde Problem Var Hata Nedeni: ${error}**`);
			queue.delete(msg.guild.id);
			return msg.channel.sendEmbed(new Discord.RichEmbed()
      .setTitle(`<:basarisiz:474973245477486612> **Şarkı Sisteminde Problem Var Hata Nedeni: ${error}**`)
      .setColor('RANDOM'))
		}
	} else {
		serverQueue.songs.push(song);
		console.log(serverQueue.songs);
		if (playlist) return undefined;
		return msg.channel.sendEmbed(new Discord.RichEmbed()
    .setTitle(` :white_check_mark: **${song.title}** Adlı Müzik Kuyruğa Eklendi!`)
    .setColor('RANDOM'))
	}
	return undefined;
}

function play(guild, song) {
	const serverQueue = queue.get(guild.id);

	if (!song) {
		serverQueue.voiceChannel.leave();
		queue.delete(guild.id);
		return;
	}
	console.log(serverQueue.songs);

	const dispatcher = serverQueue.connection.playStream(ytdl(song.url))
		.on('end', reason => {
			if (reason === ' :speedboat: | **Yayın Akış Hızı Yeterli Değil.**') console.log('Müzik Bitti.');
			else console.log(reason);
			serverQueue.songs.shift();
			play(guild, serverQueue.songs[0]);
		})
		.on('error', error => console.error(error));
	dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);

	 serverQueue.textChannel.sendEmbed(new Discord.RichEmbed()                                   
  .setTitle("**Kralbot | 🎙 Müzik Başladı**",`https://cdn.discordapp.com/avatars/473974675194511361/6bb90de9efe9fb80081b185266bb94a6.png?size=2048`)
  .setThumbnail(`https://i.ytimg.com/vi/${song.id}/default.jpg?width=80&height=60`)
  .addField('\nBaşlık', `[${song.title}](${song.url})`, true)
  .addField("\nSes Seviyesi", `${serverQueue.volume}%`, true)
  .addField("Süre", `${song.durationm}:${song.durations}`, true)
  .setColor('RANDOM'));
}

client.load = command => {
  return new Promise((resolve, reject) => {
    try {
      let cmd = require(`./komutlar/${command}`);
      client.commands.set(command, cmd);
      cmd.conf.aliases.forEach(alias => {
        client.aliases.set(alias, cmd.help.name);
      });
      resolve();
    } catch (e){
      reject(e);
    }
  });
};

client.unload = command => {
  return new Promise((resolve, reject) => {
    try {
      delete require.cache[require.resolve(`./komutlar/${command}`)];
      let cmd = require(`./komutlar/${command}`);
      client.commands.delete(command);
      client.aliases.forEach((cmd, alias) => {
        if (cmd === command) client.aliases.delete(alias);
      });
      resolve();
    } catch (e){
      reject(e);
    }
  });
};

client.on('message', msg => {
  if (msg.content.toLowerCase() === 'link') {
    msg.reply('https://kralbotdiscord.wordpress.com/');
  }
});

client.elevation = message => {
  if(!message.guild) {
	return; }
  let permlvl = 0;
  if (message.member.hasPermission("BAN_MEMBERS")) permlvl = 2;
  if (message.member.hasPermission("ADMINISTRATOR")) permlvl = 3;
  if (message.author.id === ayarlar.sahip) permlvl = 4;
  return permlvl;
};

var regToken = /[\w\d]{24}\.[\w\d]{6}\.[\w\d-_]{27}/g;
// client.on('debug', e => {
//   console.log(chalk.bgBlue.green(e.replace(regToken, 'that was redacted')));
// });

client.on('warn', e => {
  console.log(chalk.bgYellow(e.replace(regToken, 'that was redacted')));
});

client.on('error', e => {
  console.log(chalk.bgRed(e.replace(regToken, 'that was redacted')));
});

////////////////////////

client.on("guildMemberAdd", member => {
	
	var channel = member.guild.channels.find("name", "giriş-çıkış");
	if (!channel) return;
	
	var role = member.guild.roles.find("name", "Kafadar Ailesi");
	if (!role) return;
	
	member.addRole(role); 
	
	channel.send(member + " Artık " + role + " İle Botumuzu Desteklemek İçin Sunucuya Katıldı. ");
	
	member.send("Sunucumuza Hoşgeldin!")
	
});

////////////////////////

client.on("message", async message => {
    if (message.content.toLowerCase() === prefix + "nsfw") {
 if(message.channel.nsfw || message.channel.type === 'dm'){
   let embed = new Discord.RichEmbed()
   .setTitle('+18 Gözlerini Kapa Bence Sonra Uyurmadı Deme :smile: ')
   .setColor(0x00AE86)
   .setImage(("https://cdn.boobbot.us/4k/4k"+ Math.floor(Math.random() * 1460)+".jpg"))
   message.channel.send(embed)
}
 else{
       message.channel.send({embed: {
color: Math.floor(Math.random() * (0xFFFFAD + 2)),
description: ('Bu kanal NSFW kanalı değil.')
 }})
 }
}
});
 
    client.on('message', async msg => {
    if (msg.content.toLowerCase() === prefix + "disko") {
   if (msg.channel.type === "dm") return;
  const rol = 'Disko' // Rol ismi buraya
  setInterval(() => {
      msg.guild.roles.find(s => s.name === rol).setColor("RANDOM")
      }, 9000);
  }
});

client.on('channelCreate', async channel => {

  console.log(`${channel.name} :warning: Kanalı Oluşturuldu :warning: `);

if (channel.type != 'text') return;
  let sChannel = channel.guild.channels.find('name', 'log');
  sChannel.send (`${channel} :warning: _Kanalı Oluşturuldu _ :warning: `);

});

client.on('guildMemberAdd', member => {
  let guild = member.guild;
  let joinRole = guild.roles.find('name', 'Üye'); 
  member.addRole(joinRole); 

  const channel = member.guild.channels.find('name', 'giriş-çıkış');
  if (!channel) return;
  const embed = new Discord.RichEmbed()
  .setColor('RANDOM')
  .setAuthor(member.user.username, member.user.avatarURL)
  .setThumbnail(member.user.avatarURL)
  .setTitle(':inbox_tray: | Sunucuya katıldı!')
  .setTimestamp()
  channel.sendEmbed(embed); 
});

client.on('guildMemberRemove', member => {
  const channel = member.guild.channels.find('name', 'giriş-çıkış');
  if (!channel) return;
  const embed = new Discord.RichEmbed()
  .setColor('RANDOM')
  .setAuthor(member.user.username, member.user.avatarURL)
  .setThumbnail(member.user.avatarURL)
  .setTitle(':outbox_tray: | Sunucudan ayrıldı')
  .setTimestamp()
  channel.sendEmbed(embed); 
});

client.on('message', async msg => {
  if (msg.content.toLowerCase() === 'sa') {
    await msg.react('🇦');
    msg.react('🇸');
    msg.reply('**Aleyküm Selam, Hoşgeldin Kardeşim**:two_hearts:')
  }
  });

client.on("message", msg => {
    const uyarıembed = new Discord.RichEmbed()
      .setColor(0x00AE86)
      .setDescription(":crown: " + msg.author + "Reklam Yapmayı Kes Seni Yetkililere Söyledim :angry: :rage: ")

const dmembed = new Discord.RichEmbed()
    .setTitle("Sunucunda " + msg.author.tag + " reklam yapıyor!")
      .setColor(0x00AE86)
      .setDescription(" " + msg.author.tag + " Sunucunda Reklam Yapıyor k?uyar komutu ile kişiyi uyara bilir k?ban Komutu İle Kişiyi Banlayabilirsin ")
    .addField("Kullanıcının mesajı:", "**" + msg.content + "**")

if (msg.content.toLowerCase().match(/(discord\.gg\/)|(discordapp\.com\/invite\/)/g) && msg.channel.type === "text" && msg.channel.permissionsFor(msg.guild.member(client.user)).has("MANAGE_MESSAGES")) {
    if(msg.member.hasPermission('BAN_MEMBERS')){
    return;
    } else {
    msg.delete(30).then(deletedMsg => {
     deletedMsg.channel.send(uyarıembed)
     msg.guild.owner.send(dmembed).catch(e => {
            console.error(e);
          });
        }).catch(e => {
          console.error(e);
        });
      };
      };
    })

 client.on('message', message => {
    if (message.content.toLowerCase() === prefix + "zekam") {
        var sans = ["11", "15", "20", "24", "28", "31", "39", "45", "49", "54", "58", "63", "67", "77", "73", "84", "80", "83", "96", "94", "99", "Albert Einstein mısın krdşm"];
        var sonuc = sans[Math.floor((Math.random() * sans.length))];
        const embed = new Discord.RichEmbed()
        .addField(`***___Zekan___***`, `${sonuc}`)
        return message.channel.sendEmbed(embed);
    }
    });  

const { Command } = require('discord.js-commando');
const discord = require('discord.js');

module.exports = class ScanPlayingCommand extends Command {
    constructor(client) {
        super(client, {
            name: 'reklam-taraması',
            group: 'moderasyon',
            aliases: ['reklam-taraması'],
            memberName: 'reklam-taraması',
            description: 'Oynuyor mesajlarındaki reklamları arar.',
            examples: ['reklam-taraması'],
            guildOnly: true,
        })
    }

    hasPermission(msg) {
        if(!msg.guild) return this.client.isOwner(msg.author);
        return this.client.isOwner(msg.author) || msg.member.hasPermission("MANAGE_GUILD");
    }

    run(msg) {
        const members = msg.guild.members.filter(member => member.user.presence.game && /(discord.gg|discord.me|discordapp.com|discord.io|discord.tk)/g.test(member.user.presence.game.name));
        const embed = new Discord.RichEmbed()
            embed.setDescription(members.map(member => `${member}`).join("\n") || "Kimsenin oynuyor mesajı reklam içermiyor.")
            embed.setColor("RANDOM")
            embed.setTimestamp()
            embed.setFooter(`${this.client.user.username} Reklam Tarama Sistemi`)
        msg.channel.send({embed})

    }
}

const { Command } = require('discord.js-commando')
const { RichEmbed } = require('discord.js');

module.exports = class channelinfoCommand extends Command {
	constructor(client) {
		super(client, {
			name: 'ayarlar',
			group: 'ayarlar',
			memberName: 'ayarlar',
			description: 'Sunucudaki ayarları gösterir.',
			guildOnly: true,
		});
	}
	
	hasPermission(msg) {
        if(!msg.guild) return this.client.isOwner(msg.author);
        return this.client.isOwner(msg.author) || msg.member.hasPermission('MANAGE_GUILD');
    }
	
	async run(message) {
        
		const modlog = message.guild.channels.get(message.guild.settings.get('modLog'))
		const logsChannel = message.guild.channels.get(message.guild.settings.get('logsChannel'))
		const basvuru = message.guild.channels.get(message.guild.settings.get('başvuruKanal'))
		const girisCikis = message.guild.channels.get(message.guild.settings.get('girisCikis'))
		const anons = message.guild.channels.get(message.guild.settings.get('anonsKanal'))
		const girisRol = message.guild.roles.get(message.guild.settings.get('girisRol'))
		const linkEngel = message.guild.settings.get('linkEngel')

		const embed = new RichEmbed()
		.setColor("RANDOM")
		.setAuthor(`${message.guild.name} | Ayarlar`)
		.setThumbnail(message.guild.iconURL)
		.addField('❯ Mod-Log Kanalı', modlog ? modlog : `${this.client.emojis.get('464406479760392193')} Ayarlanmamış.`, true)
		.addField('❯ Log Kanalı', logsChannel ? logsChannel : `${this.client.emojis.get('464406479760392193')} Ayarlanmamış.`, true)
		.addField(`❯ Başvuru Kanalı`, basvuru ? basvuru : `${this.client.emojis.get('464406479760392193')} Ayarlanmamış.`, true)
		.addField(`❯ Giriş Çıkış Kanalı📤`, girisCikis ? girisCikis : `${this.client.emojis.get('464406479760392193')} Ayarlanmamış.`, true)
		.addField('❯ Anons kanalı', anons ? anons : `${this.client.emojis.get('464406479760392193')} Ayarlanmamış.`, true)
		.addField(`❯ Otomatik Rol/Giriş Rolü`, girisRol ? girisRol : `${this.client.emojis.get('464406479760392193')} Ayarlanmamış.`, true)
		.addField(`❯ Link Engelleme Sistemi`, this.client.provider.get(message.guild.id, 'linkEngel', []) ? `${this.client.emojis.get('464406478443249664')} Açık.` : `${this.client.emojis.get('464406479760392193')} Kapalı.`, true)
		return message.embed(embed)

	}
}

const { Command } = require('discord.js-commando');

module.exports = class BlacklistUserCommand extends Command {
    constructor(client) {
        super(client, {
            name: 'mod-log-ayarla',
            aliases: ['modlogayarla', 'modlog', 'mod-log'],
            group: 'ayarlar',
            memberName: 'mod-log-ayarla',
            description: 'Mod-log kanalını değiştirmenizi sağlar.',
            guildOnly: true,
            throttling: {
                usages: 1,
                duration: 10
            },

            args: [
                {
                    key: 'channel',
                    prompt: 'mod-log kanalı hangi kanal olsun? (#kanalismi şeklinde yazınız)\n',
                    type: 'channel'
                }
            ]
        });
    }

    hasPermission(msg) {
        if(!msg.guild) return this.client.isOwner(msg.author);
        return this.client.isOwner(msg.author) || msg.member.hasPermission('MANAGE_GUILD');
    }

    async run(message, args) {
        var ch = await args.channel;
        if (ch.type == 'voice') return message.reply('Sesli kanallar seçilemez!');
            const vt = this.client.provider.get(message.guild.id, 'modLog', []);
            const db = this.client.provider.get(message.guild.id, 'modLogK', []);
            if (vt === args.channel.id) {
                this.client.provider.set(message.guild.id, 'modLogK', true);
                message.channel.send(`${this.client.emojis.get('464406477851983883')} Mod-log kanalı zaten **${args.channel.name}** olarak ayarlı.`);
            } else {
                this.client.provider.set(message.guild.id, 'modLog', args.channel.id);
                this.client.provider.set(message.guild.id, 'modLogK', true);
                return message.channel.send(`${this.client.emojis.get('464406478153973770')} Mod-log kanalı **<#${args.channel.id}>** kanalı olarak ayarlandı.`);
            }
    }
};

const { Command } = require('discord.js-commando');

module.exports = class ModChannelCommand extends Command {
    constructor(client) {
        super(client, {
            name: 'anons-kanal-ayarla',
            aliases: ['anonskanal'],
            group: 'ayarlar',
            memberName: 'anons-kanal-ayarla',
            description: 'Anons kanalı ayarlar.',
            guildOnly: true,
			throttling: {
                usages: 3,
                duration: 5
            },
            args: [
                {
                    key: 'channel',
                    prompt: 'Hangi kanal anons kanalı olarak kullanılsın? (#kanalismi şeklinde yazınız.)',
                    type: 'channel'
                }
            ]
        });
    }
    
    hasPermission(msg) {
        if(!msg.guild) return this.client.isOwner(msg.author);
        return this.client.isOwner(msg.author) || msg.member.hasPermission("MANAGE_GUILD");
    }

    async run(message, args) {
        
        const { channel } = args;
        message.guild.settings.set('anonsKanal', channel.id);
        return message.channel.send(`${this.client.emojis.get('464406478153973770')} Anons kanalı <#${channel.id}> kanalı olarak ayarlandı.`);
    }
};

const { Command } = require('discord.js-commando');

module.exports = class BlacklistUserCommand extends Command {
    constructor(client) {
        super(client, {
            name: 'giriş-çıkış-ayarla',
            aliases: ['hoş-geldin-ayarla'],
            group: 'ayarlar',
            memberName: 'giriş-çıkış-ayarla',
            description: 'Giriş çıkış kanalı ayarlamanızı/değiştirmenizi sağlar.',
            guildOnly: true,
            throttling: {
                usages: 1,
                duration: 10
            },

            args: [
                {
                    key: 'kanal',
                    prompt: 'Giriş çıkış kanalı hangi kanal olsun? (#kanalismi şeklinde yazınız)\n',
                    type: 'channel',
                }
            ]
        });
    }

    hasPermission(msg) {
        if(!msg.guild) return this.client.isOwner(msg.author);
        return this.client.isOwner(msg.author) || msg.member.hasPermission('MANAGE_GUILD');
    }

    async run(message, args) {
            const vt = this.client.provider.get(message.guild.id, 'girisCikis', []);
            const db = this.client.provider.get(message.guild.id, 'girisCikisK', []);
            if (vt === args.kanal.id) {
                this.client.provider.set(message.guild.id, 'girisCikisK', true);
                message.channel.send(`${this.client.emojis.get('464406477851983883')} Giriş çıkış kanalı zaten **<#${args.kanal.id}>** kanalı olarak ayarlı.`);
            } else {
                this.client.provider.set(message.guild.id, 'girisCikis', args.kanal.id);
                this.client.provider.set(message.guild.id, 'girisCikisK', true);
                return message.channel.send(`${this.client.emojis.get('464406478153973770')} Giriş çıkış kanalı **<#${args.kanal.id}>** kanalı olarak ayarlandı.`);
            }
    }
};



client.login(process.env.BOT_TOKEN);
