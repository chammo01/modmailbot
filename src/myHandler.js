const config = require('./config');
const knex = require('knex')(config.knex);
const bot = require('./bot');
const actions = ["Warn", "Mute", "Kick", "Ban", "Softban"];
const embed =  {
  "embed": {
    "timestamp": null,
    "color": null,
    "author": {
      "name": null
    },
    "description": null
  }
};

module.exports.dropOldAcc = async () => {
  console.log("Dropping off old messages");
  let table = await knex('raid').select();

  for(let i = 0; i < table.length; i++) {
    if(table[i].time < Date.now()-432000000)
      knex('raid').where('msg_id', table[i].msg_id).delete();
  }
};

module.exports.customs = async (msg) => {
  if(msg.author.bot) return;

  let raidFlag = await knex('myConf').where('name', "flag").first();

  if(raidFlag.value == "true" && msg.member && msg.channel.id != "322412160888078336"//ensure guild has this module enabled
    && ((new Date(msg.member.joinedAt)).getTime() > (Date.now()-432000000)) //joined more recently than 5 days
    && (msg.member.user.createdAt > (Date.now()-432000000))) { //account created more recently than 5 days

    await knex('raid').insert({
      author_id: msg.author.id,
      msg_id: msg.id,
      msg_cont: msg.content,
      time: msg.createdAt
    });

    let raider = await knex('raid').where('author_id', msg.author.id);

    if(raider.length > 2) //only store 3 most recent messages (idk why it has to be 2)
      await knex('raid').where('msg_id', raider[0].msg_id).delete();

    if(raider.length == 3 && msg.attachments.length == 0) { //only check for matches from users who have sent more than 3 messages
      let flag  = false;

      for(let i = 0; i < 3; i++) {
//console.log(raider, raider[i]);
        if(raider[i].msg_cont != msg.content //check for all messages being the same
          || raider[i].time < (Date.now() - 1800000)) //ensure all messages are newer than 30min
          flag = true;
      }
      if(flag)
        return;

      for(let i = 0; i < 3; i++) { //delete all messages
        msg.channel.getMessage(raider[i].msg_id)
          .then(m => { m.delete(); });
      }
      let roleToAssign = await knex('myConf').where('name', "role").first();
      msg.member.addRole(roleToAssign.value); //assign role when considered raiding

      const alert = await knex('myConf').where('name', "alert_chan").first();

      let toSend = "Possible raid attempt: <@" + msg.author.id + ">\n"
        + msg.content;
      if(toSend.length > 1990)
        toSend = toSend.slice(1990);
      bot.createMessage(alert.value, toSend); //Channel to send raid alerts to

      await knex('raid').where('author_id', msg.author.id).delete(); //Clear user's raid obj
    }
  }

  if(msg.channel.type == 1 || !msg.member.roles)
    return;
  if(!msg.member.roles.includes("348669285171724290") //Principals
    && msg.author.id != 239261547959025665) //Chase's ID
    return;

  //List mods
  if((msg.content == "!mods" || msg.content == "!admins" || msg.content == "!council")
    && (msg.channel.parentID == "360553187142402048" //Staff category
    || msg.channel.id == "470438346167156736")) { //Test channel
    let IDs = [];

    if(msg.content == "!mods") {
      IDs.push("293134211270049793"); //Mods ID
      IDs.push("348669285171724290"); //Admins ID
      IDs.push("Moderators");
    }
    else {
      IDs.push("348669285171724290"); //Admins ID
      IDs.push("385619612131262464"); //Council ID
      IDs.push("Admins");
    }
    let arr = msg.channel.guild.members.filter(i => i.roles.includes(IDs[0])
      &&  !i.roles.includes(IDs[1])).map(i => i.id);

    let toSend = "";
    for(let i = 0; i < arr.length; i++)
      toSend += "<@" + arr[i] + ">\n";

    if(msg.content == "!council") {
      toSend = "Fuckin' bitches\n <a:ablobblewobble:494988637964992523>"
      IDs[2] = "Inactive Staff";
    }

    embed.embed.timestamp = (new Date()).toISOString();
    embed.embed.color = msg.channel.guild.roles.get(IDs[0]).color;
    embed.embed.author.name = IDs[2];
    embed.embed.description = toSend;

    bot.createMessage(msg.channel.id, embed);
  }

  //Show moderator activity
  if(msg.content == "!moderations") {
    let mods = {};
    let newMsg = await bot.createMessage(msg.channel.id, "Processing...");
    let messages = await bot.getMessages("494020503854383104", 6000);
    let oldest = messages[0].timestamp;

    for(let i = 0; i < messages.length; i++) {
      if(messages[i].embeds[0].fields.length > 2
        && actions.includes(messages[i].embeds[0].author.name.split(" | ")[1])) {
        let id = messages[i].embeds[0].fields[1].value.slice(2,-1);

        if(!mods[id])
          mods[id] = 0;
        mods[id] += 1;
        if(messages[i].timestamp < oldest)
          oldest = messages[i].timestamp;
      }
    }
    let toSend = "";
    let sortable = [];
    let modIDs = msg.channel.guild.members.filter(i => i.roles.includes("293134211270049793")).map(i => i.id);

    for(var heck in mods) {
      sortable.push([heck, mods[heck]]);
      modIDs.splice(modIDs.indexOf(heck), 1);
    }

    sortable.sort((a,b) => b[1] - a[1]);
    let average = 0;

    for(let i = 0; i < sortable.length; i++) {
      toSend += "<@" + sortable[i][0] + "> - " + sortable[i][1] + "\n";
      average += sortable[i][1];
    }
    if(modIDs.length > 0) {
      toSend += "\nNone:";
      for(let i = 0; i < modIDs.length; i++)
        toSend += "\n<@" + modIDs[i] + ">";
    }

    wAverage = average - sortable[0][1] - sortable[1][1]
      - sortable[sortable.length-1][1] - sortable[sortable.length-2][1];

    toSend += "\n\nAverage: " + Math.floor(average/sortable.length)
      + "\nMedian: " + sortable[Math.floor(sortable.length/2)][1]
      + "\nWeighted Average: " + Math.floor(wAverage/(sortable.length-4));

    embed.embed.timestamp = (new Date()).toISOString();
    embed.embed.color = msg.channel.guild.roles.get("293134211270049793").color;
    embed.embed.author.name = "Moderations since " + (new Date(oldest)).toDateString().slice(0,-5);
    embed.embed.description = toSend;

    bot.editMessage(msg.channel.id, newMsg.id, embed);
  }

  if(msg.content.startsWith("!rolein")) {
    if(!msg.content.includes(", "))
      return;
    let input = msg.content.split("!rolein ")[1].split(", ");
    let temp = null;

    if(/[^\d+$]/.test(input[0])) {
      temp = input[0]
      input[0] = msg.channel.guild.roles.map(r => r.name + "-" + r.id)
        .find(r => r.includes(input[0]));
      if(input[0])
        input[0] = input[0].split("-")[1];
      else {
        bot.createMessage(msg.channel.id, "*Failed:* I can't find \"" + temp + "\"");
        return;
      }
      temp = input[1]
      input[1] = msg.channel.guild.roles.map(r => r.name + "-" + r.id)
        .find(r => r.includes(input[1]));
      if(input[1])
        input[1] = input[1].split("-")[1];
      else {
        bot.createMessage(msg.channel.id, "*Failed:* I can't find \"" + temp + "\"");
        return;
      }
    }

    let arr = msg.channel.guild.members.filter(i => i.roles.includes(input[0])
      &&  !i.roles.includes(input[1])).map(i => i.id);

    let toSend = "";
    for(let i = 0; i < arr.length; i++)
      toSend += "<@" + arr[i] + ">\n";

    if(arr.length > 75)
      toSend = "Too many members to list them, sorry!";

    embed.embed.timestamp = (new Date()).toISOString();
    embed.embed.author.name = arr.length + " Members";
    embed.embed.description = toSend;

    bot.createMessage(msg.channel.id, embed);
  }

  //Config options
  if(msg.content.startsWith("!antiraid")
    && msg.member.roles
    && (msg.member.roles.includes("385619612131262464") //The High Council
    || msg.author.id == 239261547959025665)) //Chase's ID
    myConfig(msg, raidFlag);

  //Eval
  if(msg.author.id != "239261547959025665")
    return;
  if(!msg.content.startsWith("!eval"))
    return;

  const args = msg.content.split(" ").slice(1);

  try {
    const code = args.join(" ");
    let evaled = await eval(code);

    if (typeof evaled !== "string")
      evaled = require("util").inspect(evaled, {depth:1});

    bot.createMessage(msg.channel.id, "```js\n" + clean(evaled) + "```");
  } catch (err) {
    bot.createMessage(msg.channel.id, `\`ERROR\` \`\`\`xl\n${clean(err)}\n\`\`\``);
  }

};

//Antiraid options support
async function myConfig(msg, raidFlag) {
  let toSend = null;
  //LB anti-raid toggle
  if(msg.content == "!antiraid"
    && (msg.channel.parentID == "360553187142402048" //Staff category
    || msg.channel.id == "470438346167156736")) { //Test channel

    if(raidFlag.value == "true")
      await knex('myConf').where('name', "flag").update('value', "false");
    else
      await knex('myConf').where('name', "flag").update('value', "true");

    const newFlag = await knex('myConf').where('name', "flag").first();
    toSend = "**" + msg.member.user.username + "** (" + msg.author.id
      + ") set antiraid to: " + newFlag.value;
    bot.createMessage(msg.channel.id, toSend);
  }
  else if(msg.content.startsWith("!antiraid role")) {

    const newRole = msg.content.split("role")[1].trim();

    if(msg.channel.guild.roles.map(m => m.id).includes(newRole)) {
      knex('myConf').where('name', "role").update('value', newRole);

      toSend = "**" + msg.member.user.username + "** (" + msg.author.id
        + ") set the antiraid role to: <@&" + newRole + "> (" + newRole + ")";
    }
    else
      toSend = "*Failed:* Enter a valid role ID.";

    bot.createMessage(msg.channel.id, toSend);
  }
  else if(msg.content.startsWith("!antiraid alert")) {

    const alertChan = msg.content.split("alert")[1].trim();

    if(msg.channel.guild.channels.map(c => c.id).includes(alertChan)) {
      await knex('myConf').where('name', "alert_chan").update('value', alertChan);

      toSend = "**" + msg.member.user.username + "** (" + msg.author.id
        + ") set the antiraid alert channel to: <#"
        + alertChan + "> (" + alertChan + ")";
    }
    else
      toSend = "*Failed:* Enter a valid channel ID.";

    bot.createMessage(msg.channel.id, toSend);
  }
};

//Eval support
function clean(text) {
  if (typeof(text) === "string")
    return text.replace(/`/g, "`" + String.fromCharCode(8203)).replace(/@/g, "@" + String.fromCharCode(8203));
  else
      return text;
};
