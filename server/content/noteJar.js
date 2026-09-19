// PRIVATE original notes: the owner's profile/Q&A and requested praise-first voice.
// Research, editorial choices and mood rules: docs/redesign/NOTE-JAR-VOICE.md.
// Content-derived IDs keep old delivered snapshots intact while new writing becomes unread.
import { createHash } from "node:crypto";

const groups = [
  {
    "theme": "art",
    "label": "ur art deserves some love",
    "notes": [
      "I lovee the way u draw babyy, i was sooo mesmerized by ur art style the firt time i saw it because its soo gentle, know u will always have someone who will always love ur work✨",
      "I find it soo awesome how u can picture diffrent scenarios in ur head and make literal drawings of them soo vivdly, it may be common for u but i will alway find that super cool!",
      "I would be able to spot ur drawings out of 1000 in a heartbeat, that how unique ur art is too mee just like its creator. Be proud of that and if not ill be proud for the both of us:)",
      "I just love how detailed ur art is babyy, whenever i get the chance to see u draw, i always see how u place each detail and i just catch myself watching in awee.",
      "craazzy u can switch from digital art to physical drawings and still keep ur sense of stylee, again..wow, i have such a cool girl✨",
      "Ur character designs always have me in genuine awe babyy, always soo serene and gentle looking, i could stare at them for hours cause it feels calming to admire ur work :)",
      "Anytime u say u dont like sum about ur drawin...i always feel like ur on a whole diffrent level of creativity because if the drawing already looks this good then i cant picture what perfection looks to u!",
      "Ur rough sketches or doodles make me sorry for even touching a pencil baby!!!",
      "I loveee how ur able to express ur feelings through ur art, its soo beautiful to me like the pictures u make for uss",
      "u don't need a completely original species of brush to have good ideas. ur imagination is already doing plenty.",
      "there's something so cool about knowing someone who can make their own fan arttt like hollly!",
      "ur art no matter how silly always takes me a good few seconds to truly take it all in cause anything u create i find myself scanning it over and over and i love it baby!",
      "I want to save a wall in our house and hang one giant piece of ur masterpiece there to look at every single dayy, that is how much i love ur work babyy.",
      "Im soooo happy our kids will have the perfect example of true creativity when they grow up, u will become the measuring tape of what it means to be a true artist my lovee!",
      "the care u put into learning to draw matters. it didn't all come preinstalled with the ipad.",
      "i like that ur creativity shows up in so many ways like digital, paper, sculptures, I want to get a display shelf when we have our own house babyyy, all ur works!"
    ]
  },
  {
    "theme": "cosplay",
    "label": "a little cosplay appreciation",
    "notes": [
      "Ur maomao cosplay is soo pretty babyy, the green braids, the pink, that little expression on ur face..u suit that look sooo perfectly and i genuinly cant look away✨",
      "Miku, maomao AND lynette?? u have sooo much range baby, every time i go through ur cosplay folder it just keeps proving it more and more, my talented girl💕",
      "I dont think ur wig styling gets enough credit babyy, thats an actual skill and u have it, we always skip past that way too fast and i refuse to do that anymore!!",
      "U look soo cute in cosplay but what i love even more is that u care enough about a character to bring them into ur own world like that, its soo u my lovee💕",
      "The maomao pic with ur hand by ur cheek is sooo adorable baby, yes i have favourites and thats one of them, i cant help it, thats my girl:)",
      "Ur peeking over the sleeve pic has such good maomao energy babyy, soo pretty and the side eye is wayy too believable, like u werent even acting😊",
      "I love ur cosplays because theyre urs babyy, the girl inside the costume is honestly my favourite part of every single one, and shes minee✨",
      "U can make a favourite character feel a little more real just by being them baby, i think thats such a cool thing to be able to do, genuinly",
      "I have sooo much respect for how u style wigs baby, getting fake hair to actually listen to u sounds like a whole career on its own, and u do allat for fun💕",
      "A maomao look from someone who actually loves maomao just hits diffrent, u bring all that excitement with it and it shows babyy",
      "Even on the days one detail just refuses to behave, ur cosplay skills still deserve all the credit baby, difficult hair just has a mind of its own sometimes, dont let it win!!",
      "Miku has sooo many versions so ofc ur cosplay wishlist is that long, it makes total sense too mee babyy, i want to see every single one✨",
      "U already brought lynette into ur cosplay lineup..like u actually did that baby, thats such a cool thing to have done, im soo proud of uu✨",
      "The costume is cute but the care u put into choosing the character is just as cute babyy, theres soo much to appreciate about it and i notice all of it",
      "I hope u get a pic of ur next look that makes u go wait..i look GOOD, because u do baby, and if u dont see it ill keep telling u until u do💕",
      "I love how cosplay lets ur art, ur favourite stories and ur style all meet in one place, it makes sooo much sense for u my lovee",
      "A reference can help u with a wig but it cant give u the excitement u have for the character babyy, thats all u and thats the best part",
      "U dont need a new cosplay to impress mee baby, maomao, miku and lynette already have me impressed more than enough, but i wont complain if u do another one😊",
      "Whether ur next look is another miku or sum from a whole diffrent world, ur curiosity is such a good thing to bring along with u babyy",
      "Ur maomao pics are literally the front of this whole little world i made for u baby, honestly the best casting choice i couldve made, thats my girl:)"
    ]
  },
  {
    "theme": "ballet",
    "label": "for the dancer too",
    "notes": [
      "Ballet is genuinely sooo hard with allat on point stuff and u actually train in it babyy, im soo impressed, u dont even have to make it look easy for that to count",
      "Drawing, cosplay, ballet, singing...baby thats sooo much talent for one girl to just casually be carrying around, i want somee",
      "I think its soo cool that ur creativity can turn into movement and not just pictures, u have more than one way to say sum and i love that",
      "The patience it takes to learn ballet deserves its own compliment so here it is babyy, im soo proud of all that effort✨",
      "A bad practice doesnt make u a bad dancer baby(nevaa) like u be sayin \"lost all my skill\", it just makes u a dancer who had a wobbly practice, thats a completely diffrent thing",
      "U chose a hobby that takes real practice and i love that u care about things enough to keep learning them my lovee, soo proud of u!!",
      "I hope dancing gives u moments that feel good just for u babyy, u deserve the fun part just as much as the progress",
      "Ur creative range is kinda craazy baby, in the best way, the pencil and the ballet shoes both have their work cut out for them",
      "U can love ballet and still have days where practice is annoying, loving sum doesnt mean it wont test u sometimes babyy",
      "One hard part isnt the whole story of ur dancing baby, theres a patient girl who genuinely loves this behind that moment",
      "I admire all the effort that never ends up in a pic or said out loud my love💕, all the repeating, learning and trying again still counts soo much, i notice and always will",
      "U dont need to turn a dance into an audition for being good enough babyy, im already cheering for u no matter whatt, i wish i could watch u dance one day✨",
      "Theres sum soo lovely about loving music enough to move with it, ur interests really do understand each other",
      "Im cheering for the still learning version of u too my lovee, always here when u have a bad dayy😊",
      "Ballet and wig styling both need u to be patient with the tiniest details, thats such a specific skill set babyy and i respect it sooo much, genuienly!",
      "Taking a break doesnt erase any of the work u put into dancing baby, ur progress wont get offended and leave u",
      "I hope u let urself feel proud of a little improvement without instantly giving urself a harder task babyy, u earned that moment, if not ill be proud for the both of us my lovee, thats my fuckin girl!!!!",
      "Being willing to learn sum this difficult is sooooo cool, u dont have to finish learning it before i can say that baby",
      "A song, a little movement, no score..sometimes just enjoying urself is the whole point and u deserve that too my lovee✨"
    ]
  },
  {
    "theme": "music",
    "label": "good taste, btw",
    "notes": [
      "I love how much u care about music babyy, someone who gets that excited over a song is the best company to have, u genuinly influenced me to listen more ✨",
      "U singing along cause u love the song is soo lovely babyy, not to mention ur angelic ass voicee✨",
      "Ur vocaloid enthusiasm is sooo cute, i fully support the super specific explanation of why this version matters :)",
      "I would totally hand u the aux if we went on a drive togetherr, thats how awesome ur taste is babyy💕",
      "I love how ur interests connect, a song turns into a drawing idea, a character turns into a cosplay..such a cool brain babyy, im envious of uu but its okay cause ur minee!",
      "Rin and len story songs?? baby ur playlist comes with lore, other people just have background music and u have a whole plot",
      "I think its soo sweet that u make room for singing in ur life baby, ur happiness deserves a voice too and its fucking beautiful!",
      "Miku first, with room for rin, len and everyone else..i fully respect the playlist priorities babyy",
      "If u want to explain why a song is good go for it baby, ur interest in stuff is one of the things i love most about u",
      "One song on repeat isnt a flaw babyy, sometimes the chorus is just doing its job really really well",
      "Wonderlands×showtime, vivid bad squad, leo/need..u have soo many options for the soundtrack and i love the range",
      "U have a whole vocaloid world to enjoy baby, loving it this much is part of ur charm, never sum to apologize for",
      "I love that u can love a classic and still get excited about sum new, good taste doesnt have to pick one era forever babyy",
      "If a song makes u want to draw, i hope u get the chance to try the idea baby, ur hobbies make the cutest little team✨",
      "U dont have to sing perfectly to deserve to sing babyy, the part where u enjoy it matters sooo much to me",
      "Ur music taste has soo much personality, just like the girl picking it, thats a compliment to both of u babyy :)",
      "Boa, mitski, loving caliber, arctic monkeys, cigarettes after sex AND the whole vocaloid world?? babyy ur playlist has no business being that good💕",
      "A cigarettes after sex song at night with u talking over it sounds like the perfect evening too mee babyy, ur taste sets the whole mood✨",
      "U can go from boa to arctic monkeys to a miku song without blinking baby, genuinly impressive, i want somee of that range",
      "Loving caliber and mitski in the same playlist?? u really have a song for every single feeling babyy and i love that about uu",
      "A mitski song when ur feeling sum and arctic monkeys when ur not..u always know exactly what u need to hear baby😊",
      "Ur taste isnt just vocaloid and people sleep on that babyy, boa, mitski, loving caliber..u have layers and i love allat"
    ]
  },
  {
    "theme": "fandom",
    "label": "for ur very specific interests",
    "notes": [
      "U and maomao both get properly invested in what u care about babyy, hers just come in suspicious little jars and urs have way better album art💕",
      "I love that ur interests arent vague at all, theres characters, versions, outfits and REASONS, its soo fun being with someone who cares allat much baby",
      "Frieren and witch hat atelier on ur cosplay wishlist makes total sense babyy, more beautiful worlds for that imagination of urs to wander into✨",
      "Ur favourite characters get art, music AND cosplay from u...honestly being one of ur faves sounds like a pretty good deal baby, im a little jealous of them😊",
      "U can be super into a fictional world and still be a very cool real person babyy, and ur proving it perfectly, genuinly",
      "Project sekai, genshin, star rail..ur interests have a full schedule baby and i love how much there is to get excited about with uu",
      "I think its soo cute that a character can make u want to draw or plan a look, u turn liking sum into actual creativity babyy, thats a real talent💕",
      "Maomaos curiosity is a big part of her charm and i love that u have ur own things u want to know absolutely everything about my lovee",
      "A fandom isnt an exam baby, u can be there just because the character makes u happy, ur excitement already belongs and nobody can tell u otherwise",
      "Witch hat atelier and ur love for drawing just make sooo much sense together, i love seeing ur interests meet like that babyy✨",
      "U dont need to be less excited to look cool baby, caring about sum is already interesting too mee, always has been",
      "From bungo stray dogs to miku theres sooo much going on in ur favourite worlds babyy, i respect a well stocked imagination, i want somee",
      "I love that music and idol anime are part of ur world too, singing, stories, characters..its all soo u baby💕",
      "All ur interests make u sooo interesting to talk to babyy, theres always another reason for me to go wait tell me more, i could listen to u for hours",
      "Maomao would stare at a leaf for ages and u could talk about a favourite character forever, i see the appeal of both baby:)",
      "A pretty character design being worth ur attention is reason enough, u have an artists curiosity and it deserves to enjoy itself babyy",
      "Keeping a favourite character around on a rough day makes total sense baby, a little familiar company can be really nice, and so can i😊",
      "I hope u find sum today that makes u stop and go oh this is SO my thing babyy, ur happiness genuinly deserves that",
      "U dont need to buy every new thing to prove u love a fandom baby, ur love for it is already sooo obvious to everyone, especially mee",
      "Theres sum soo lovely about a girl who still gets excited over songs, stories and tiny details, and thats u my lovee✨"
    ]
  },
  {
    "theme": "kindness",
    "label": "this is something i like about u",
    "notes": [
      "U have such a kind heart and a very active commentary track babyy, i love both, together theyre perfect💕",
      "I think ur caring side is one of the prettiest things about u baby, and yes im being completely serious, let me have this moment",
      "Animals liking u says soo much about u, they have no reason to fake it..they just know a good soul when they see one babyy",
      "U can be so thoughtful that it genuinly makes me stop for a second baby, that kind of care is a big deal, dont u ever forget that",
      "I love that u can be sassy without ever losing ur soft heart babyy, both of them deserve all the appreciation, thats my girl",
      "U make people happy baby, thats a real thing i wanted this whole world to remind u of, and im soo glad its written down now💕",
      "Ur kindness isnt just a cute extra after all ur talents, its one of the biggest reasons u deserve to be appreciated my lovee",
      "U deserve people who actually care when u talk about ur art, music or a tiny cosplay detail babyy, ur excitement is always worth listening to, always",
      "I think being caring is sooo cool, people act like it isnt sometimes but honestly thats their loss baby, not urs",
      "Theres sooo much to admire about u but ur kind soul really matters too mee, i hope someone is gentle with u today too babyy😊",
      "U dont need to be the funniest person in the room to be good company baby, i love the quiet version of u just as much",
      "I love that theres soo much warmth behind ur sass babyy, it makes the commentary even cuter, genuinly",
      "U can take this compliment without doing anything for me baby, ur kindness isnt a subscription u have to keep paying for",
      "Being kind doesnt mean u have to say yes to everything babyy, i love u with boundaries too, protect ur peace!!",
      "A caring girl with creative hobbies and a sense of humour is such a good person to know..hi baby, thats uu:)",
      "I hope u get some of the care u give back today my lovee, u deserve to be thought about just as warmly💕",
      "Theres a big diffrence between being nice for show and actually caring, and whenever i describe u i always say caring babyy, that matters soo much",
      "Ur company doesnt need a finished drawing, a new cosplay or a funny story attached baby, u being there is already sum good",
      "I love that u have room in ur heart for people and for all the things u love, theres soo much heart in ur little world babyy✨",
      "Please put urself on the list of people who deserve patience baby, i happen to love that girl a whole lot💕"
    ]
  },
  {
    "theme": "humour",
    "label": "affection, with commentary",
    "avoidFeelings": [
      "sad",
      "anxious",
      "overwhelmed",
      "angry"
    ],
    "minEnergy": 2,
    "notes": [
      "Pretty, funny AND talented?? okay babyy save sum for the rest of the character creation screen",
      "U have enough hobbies to fill a whole group chat and somehow theyre all u baby, very impressive..and a little scary scheduling wise😊",
      "Ur miku love is not subtle at all babyy, luckily being subtle was never a requirement for having amazing taste",
      "I came here to leave u a normal compliment and then remembered u do ballet AND style wigs..casual, apparently, allat talent for one girl",
      "U and maomao would start a quiet afternoon and end it talking about sum super specific, and i would be the one bringing the snacks baby",
      "Ur just saying that..yes babyy, because ur cool, craazy how that works:)",
      "Ur hobbies have side quests and the side quests have reference folders baby, i respect the commitment sooo much",
      "If miku had a loyalty program i feel like u would know the terms and conditions better than the staff babyy, genuinly",
      "U being kind and sassy at the same time is sooo funny to me baby, warm welcome with a very high chance of commentary💕",
      "I love ur sense of humour babyy, ur opinions sometimes come with bonus entertainment and im not complaining at all",
      "Pretty AND knows exactly what a wig needs?? babyy ur character sheet is getting a little unfair to the rest of us",
      "This is another compliment baby, i know, craazy, try to stay calm while being appreciated:)",
      "Maomao gets excited about herbs, u get excited about miku..everyone has a very specific reason to lose it a little babyy",
      "Ur idea of having normal interests somehow includes a whole cosplay cast baby..honestly keep going, i love allat about u",
      "U dont have to pretend to be effortlessly cool babyy, enthusiastically nerdy is working sooo well for u, genuinly",
      "This jar has one job, remind u how cool u are baby, and u keep coming back so i guess its working😊",
      "U asked for one nice thing about urself and accidentally opened a site with a whole library of them babyy..u just have to deal with being appreciated now",
      "U being funny is a problem because now i have to actually put effort into conversations baby, rude..please keep going anyway",
      "A miku song, a sketchbook, a cosplay idea..ur version of nothing much has suspiciously good creative direction babyy",
      "U have main character interests with an amazing supporting cast baby, miku and maomao are very busy in this household💕"
    ]
  },
  {
    "theme": "style",
    "label": "yes, ur pretty",
    "notes": [
      "Ur really pretty kiriya, i just wanted one note to say it without turning it into a whole speech babyy💕",
      "Ur smile is sooo cute baby, thats it, thats the important information i needed to tell u today😊",
      "U look soo lovely in ur maomao pics babyy, theres soo much charm in those little expressions, genuinly",
      "Cute looks and skater fits both suit u sooo well baby, i love that ur style has room to change, u pull off allat",
      "Purple and pink are such good colours babyy, and u being the one wearing them makes them even better✨",
      "U dont need to be in cosplay for me to look at u all heart eyed baby, kiriya without a character outfit is just as lovely💕",
      "I love ur taste babyy, the colours, the characters, the clothes..ur little world feels like someone soo interesting lives in it",
      "U can look this pretty and have zero interest in socializing baby, both of those can be true at the same time and they are",
      "Ur smile deserves a compliment on a random day too, it doesnt need to wait for a birthday or a good pic my lovee",
      "I think ur cool in the way that actually matters babyy, u have ur own taste and things u care about, thats my girl",
      "A sweet look today and a totally diffrent vibe tomorrow?? i love that u give urself options baby, u dont have to pick one forever",
      "Ur cosplay pics are soo cute but the girl in them deserves the compliment on a normal day too babyy, shes minee and shes gorgeous💕",
      "Theres sum soo endearing about u baby, the smile, the sass, all those interests..its the perfect combo, genuinly",
      "I hope u catch a look at urself today and feel a little love for her babyy, and if u dont see it ill be seeing it for the both of us",
      "Ur pretty, ur kindness is lovely and ur humour is soo good baby, a whole lot of things are going really well here😊",
      "Ur taste doesnt need everyones approval to be good babyy, the stuff u love already makes such a nice world together",
      "I love that u can care about how sum looks AND have soo many other things to say baby, theres sooo much to uu",
      "The maomao smile pic and the sleeve pic have totally diffrent vibes and both are sooo cute babyy, ur range has been noted:)",
      "U deserve compliments that dont secretly ask u to change sum baby, so this ones simple..i think ur lovely💕",
      "Whatever feels like u today i hope u get to enjoy it babyy, i love the girl, not a dress code"
    ]
  },
  {
    "theme": "rest",
    "label": "a tiny reminder, because i care",
    "notes": [
      "Ur still cool even with a low battery baby, no funny reply or finished drawing needed, just u is perfect💕",
      "Save the drawing and give ur hands a minute babyy, i love the artist way too much to only care about the picture",
      "If u forgot to drink water while getting into a project, heres ur little reminder baby, talented people still need a drink too!!",
      "The wig can be difficult tomorrow babyy, ur patience deserves a break tonight if u need one😊",
      "If food got pushed aside for a project please take a break for it baby, im cheering for u, not for u skipping the basics",
      "U can enjoy a miku song without doing anything productive at the same time, just listening is a perfect plan babyy",
      "A quiet evening doesnt make u boring baby, ur still full of personality even when none of it is up for comment right now",
      "Put the pencil down for a bit if ur hands are tired babyy, the girl who makes the art deserves to be looked after too💕",
      "U dont have to reply while ur battery is empty baby, id rather u have a little peace than force a happy message, always",
      "Rest doesnt have to make u more productive later to be worth it babyy, i just care about u having a nice moment right now",
      "One more detail can turn into ten more details really fast baby, save where u got to, ur idea will still matter tomorrow",
      "U can be super talented and still have a do nothing hour babyy, i promise ur talent wont take it personally😊",
      "If ur eyes need a break from the screen the site can wait baby, miku isnt going anywhere and neither is this jar",
      "A comfy outfit and sum nice to listen to is more than enough of a plan for tonight babyy, u dont need to impress the calendar",
      "Put on cigarettes after sex, lie down and do absolutely nothing baby, that counts as a whole evening plan too💕",
      "The way u care for other people is soo lovely babyy, just keep a little bit for the girl holding the phone too",
      "Low social battery doesnt make u bad company baby, it just means u need a recharge, the interesting girl is still right there",
      "Let a project stop at a good place to pause sometimes babyy, it doesnt always have to end at completely exhausted",
      "I think ur worth looking after before everything is finished my lovee, the unfinished stuff can wait its turn",
      "U dont have to fill the silence with a joke baby, i love u when ur just quietly existing too💕",
      "If today needs the smaller version of everything thats okay babyy, a tiny doodle, one song, then rest..its still ur dayy"
    ]
  },
  {
    "theme": "tough",
    "label": "a little love, a little nudge",
    "feelings": [
      "happy",
      "excited",
      "content",
      "playful"
    ],
    "minEnergy": 2,
    "notes": [
      "Reminder babyy, u cant fairly judge ur art if ur only listing what went wrong, give the good parts a turn too",
      "U would never call a friend useless over one bad drawing baby, so please dont give urself the deluxe version of that either",
      "Save the file before one more tiny change babyy, i believe in ur art..i do NOT believe in trusting a battery percentage",
      "U have real skills baby, brushing off every compliment doesnt make u more humble, it just makes my compliments work overtime",
      "A reference folder isnt a drawing yet babyy, if u actually want to start, one messy line is enough, u can build from there",
      "If u keep moving the finish line u never get to enjoy what u did baby, pause long enough to let a win actually be a win!!",
      "Being kind doesnt mean everyone gets unlimited access to ur time babyy, u can say no and still be a really good person",
      "The perfect idea might not show up first, try the interesting one anyway baby, ur curiosity is worth trusting, genuinly",
      "U dont need to insult ur own drawing before u show it babyy, let people see the art without the apology tour first",
      "Watching another tutorial helps sometimes but actually trying helps too baby, u have the hands and a very capable brain, go for it",
      "If ur comparing ur rough sketch to someone elses finished piece the comparison is rigged babyy, ur work deserves a fairer look",
      "Ur cosplay wishlist is soo exciting baby but pick the part u actually want to try first, u dont need to become the whole cast this week",
      "Stop giving every tiny mistake the main role babyy, ur effort and the parts u like deserve to be in the scene too",
      "U dont have to wait until u feel super confident to make art baby, a little curiosity and a messy first try is enough to start",
      "Being good at sum doesnt mean every attempt will be easy babyy, u can be talented AND need another try, both are true",
      "If u want a break then take the break baby, sitting there being mean to urself isnt secretly a more productive option",
      "U can love miku without turning a cosplay plan into a punishment babyy, leave room for the part thats supposed to be fun",
      "Let people like ur work baby, u dont need to investigate every compliment like its a scam:)",
      "A bad practice is sum to learn from, not a reason to start on urself like u be sayin \"lost all my skill\", nevaa babyy, i happen to love that dancer a lot",
      "Be honest with urself sure, but honest also means admitting u have talent, kindness and soo much worth loving, thats my fuckin girl!!"
    ]
  },
  {
    "theme": "sad",
    "label": "still very glad ur here",
    "feelings": [
      "sad"
    ],
    "notes": [
      "If today has been rough i still think ur lovely babyy, the funny, creative, caring girl hasnt gone anywhere💕",
      "U dont have to cheer up for this note baby, i just wanted to remind u that ur someone worth caring about",
      "I think ur drawings are cool and i think ur kind babyy, none of that goes away on a sad day",
      "Ur still the girl with all those interests and that lovely smile baby, u dont have to feel like her every second",
      "Im sorry things feel heavy babyy, no speech about the bright side..just a little love for u right here💕",
      "U make other peoples days nicer baby, i hope this gives even a small bit of that care back to u",
      "If u dont feel like being funny today then dont babyy, i love the girl behind the jokes just as much",
      "A mitski song or a favourite character can keep u company for a bit baby, they dont have to fix the day to be nice to have",
      "U dont have to be okay with everything to be loved my lovee, sad u is still someone soo lovely",
      "I hope u can be a little softer with urself tonight baby, the girl ur being hard on has a really good heart😊",
      "One hard day cant explain all of u babyy, theres art, music, curiosity and soo much kindness in there too",
      "Ur pretty but u dont owe anyone a smile right now baby, this compliment doesnt come with instructions",
      "If all u can manage is a quiet minute then take it babyy, i still think ur the best company",
      "Pull another note if u want baby, wanting a little reassurance isnt embarrassing, i made this whole jar because u matter💕",
      "If u want company u can reach out without making ur feelings sound neat first babyy, always here when u have a bad dayy😊"
    ]
  },
  {
    "theme": "anxious",
    "label": "no pressure from this little note",
    "feelings": [
      "anxious"
    ],
    "notes": [
      "Being nervous doesnt cancel out being capable baby, the artist, dancer and cosplayer in u are all still there",
      "U dont have to impress this jar babyy, i already think ur interesting, kind and sooo worth knowing💕",
      "If ur brain is listing everything that could go wrong, heres sum true right now baby, uve handled learning hard things before",
      "One unsure moment doesnt make u bad at this babyy, ur skills dont need u to feel confident all the time",
      "U can ask what someone meant instead of guessing every possible meaning baby, ur peace is worth one small question",
      "I love how much u care about getting things right babyy, u deserve some patience while u figure them out too",
      "If a project feels big just look at one little part baby, u dont have to style the whole wig in one thought",
      "A slow reply doesnt tell the whole story of what someone thinks of u babyy, theres soo much a notification cant show u",
      "U dont have to earn being treated kindly by saying the perfect thing baby, a little awkward is still very easy to love💕",
      "Ur creativity is still a good thing even when choosing what to make feels hard babyy, the ideas dont need sorting all at once",
      "I think ur cool without a perfect plan baby, u can be interesting and still be figuring out the next step",
      "If everything feels a bit loud, put on sum familiar for a minute babyy, a boa song, a character u love, a quieter part of the day😊",
      "U can check one thing at a time baby, theres no need to solve every version of the afternoon before it even happens",
      "Ur not a disappointment because u need reassurance my lovee, ur kind heart deserves a kind answer too",
      "This note expects absolutely nothing from u baby, i just wanted to say ur such a lovely person, even when ur thoughts arent being lovely to u"
    ]
  },
  {
    "theme": "overwhelmed",
    "label": "one quiet bit of care",
    "feelings": [
      "overwhelmed"
    ],
    "notes": [
      "Theres a lot going on but u dont have to become less important than all of it babyy, i care about the girl doing all the juggling💕",
      "U can put the drawing, the messages and the next cosplay idea down for a bit baby, ur still creative even when ur resting",
      "If today feels like too many tabs open, this note isnt another tab asking u for sum babyy, its just a little love",
      "Ur kind and talented and probably deserve way fewer demands right now baby, being both doesnt mean u have to handle everything",
      "Make one thing smaller if u can babyy, a short reply, a tiny step, a project for later..ur effort still counts",
      "I love u without a finished to do list baby, ur company doesnt need proof that u got everything done",
      "If u need quiet then take some babyy, the girl with all those lovely interests will still be interesting after a break😊",
      "U dont need to make being overwhelmed look graceful baby, i care about how ur actually doing more than how well u hide it",
      "All those skills are urs but u dont have to use every single one today babyy, some can just sit there looking impressive",
      "Maomao can keep her jars organized and u can leave sum unfinished for now baby, nobody needs a perfect desk to deserve care",
      "If choosing feels like too much, one cigarettes after sex song is a perfect place to stop choosing for a bit my lovee",
      "U can tell someone i need a minute baby, a caring person is allowed to need care too💕",
      "Ur imagination doesnt need another assignment right now babyy, it can just enjoy a pretty picture and clock out",
      "I think ur special for who u are baby, not for how much u can carry before it gets heavy",
      "This is a small note with a small job babyy, to remind u that u matter, even when the day is demanding everything else"
    ]
  },
  {
    "theme": "angry",
    "label": "on ur side, with some sense",
    "feelings": [
      "angry"
    ],
    "notes": [
      "Being annoyed doesnt make u any less kind baby, u can have a good heart and zero patience for nonsense today",
      "Ur maomao side eye would be totally understandable right now babyy, take the quiet corner if u need it, no performance needed",
      "U dont have to send the first version of the reply baby, let the all caps draft cool down before it goes public😊",
      "I love ur sass babyy, but i also love the version of u that protects ur peace instead of giving the whole evening to an argument",
      "Not today is a complete answer baby, u dont need to hand in proof to get a little space",
      "U can care about someone and still be annoyed with them babyy, feelings are inconvenient like that, ur kindness is still real",
      "If sum hurt u, u dont have to turn it into a joke to make everyone else comfortable baby, ur feelings deserve to be heard for real💕",
      "This note has no calm down speech babyy, just a reminder that ur worth looking after while u figure out what u want to do next",
      "Whatever the situation is, u deserve the chance to respond the way u actually mean to baby, a little pause can help with that",
      "Nobody gets automatic access to ur whole social battery babyy, especially not when its already on the tiny red bar",
      "Ur caring side doesnt have to quit just because ur irritated baby, it can take a break while u set a boundary",
      "A bad conversation doesnt get the rest of ur playlist for free babyy, put on arctic monkeys and keep some of the evening for urself",
      "If the situation deserves a maomao stare then fine baby, just dont let it convince u that ur whole day belongs to it",
      "U can be pretty, talented and completely unimpressed all at the same time babyy, no contradiction there",
      "I love u with opinions baby, take ur time finding the words u want, u dont have to say them right away, im on ur side either way"
    ]
  },
  {
    "theme": "happy",
    "label": "let me hype u a little",
    "feelings": [
      "happy"
    ],
    "notes": [
      "I hope u let urself enjoy the good mood babyy, being happy looks sooo good on a girl with this many things to love💕",
      "U have lovely art to make, good music to hear and soo much personality baby, im glad ur here for the fun parts too✨",
      "If u like sum u made today say it babyy, i love the idea of u being ur own biggest fan for a minute, thats my girl!!",
      "Ur smile is sooo cute baby and i hope today gives it a few good reasons to show up, thats all, just that:)",
      "A happy kiriya with a loving caliber song on sounds like the best part of the day babyy, keep some time for it if u can",
      "Small win?? im interested, good wig detail?? interested, nice colour?? sooo interested baby, ur excitement counts",
      "I love how ur excitement makes all these interests feel alive babyy, ur favourite things have the best fan in uu",
      "If today feels nice u dont have to turn it into a productive day right away baby, just enjoying it is already a good use of it😊",
      "Ur kind heart, ur creativity, ur humour..theres soo much to celebrate about u even on a normal day my lovee💕",
      "Put on a song u love and enjoy being u for a bit baby, i happen to think thats the coolest girl to be✨",
      "I hope sum makes u laugh for real today babyy, ur sense of humour deserves some good material back",
      "U can keep a little happy moment without proving it was a big deal baby, if it mattered to u im soo glad it happened",
      "Yes u can be proud of ur art babyy, this jar fully supports a little wait..i actually made that moment, thats my fuckin girl!!!",
      "My lovely girl having a lovely part of her dayy..im very very happy about this baby💕",
      "If ur feeling good about urself let it stay babyy, u dont need to balance a compliment with three criticisms",
      "A good mood, an arctic monkeys song and nowhere to be..thats the kind of dayy i want for u baby✨",
      "Ur happiness is genuinly my favourite thing to hear about babyy, tell me every little good thing that happened today💕"
    ]
  },
  {
    "theme": "excited",
    "label": "okay, tell me everything",
    "feelings": [
      "excited"
    ],
    "notes": [
      "Okay tell me the idea babyy, character, colours, song, craazy specific wig detail..i love u when ur excited about things",
      "Ur excitement is sooo cute baby, even if i have to learn three new character names before the explanation starts:)",
      "New cosplay idea?? im listening babyy, u have amazing taste and a very convincing amount of excitement",
      "I love that ur brain can see a character and instantly start making plans baby, my creative little menace✨",
      "If a miku thing got u excited i want the full explanation babyy, even if which miku takes a minute😊",
      "U can use as many exclamation marks as u want about this baby!!! being happy about sum isnt embarrassing, i love that u care",
      "That rush of wanting to draw sum is the best feeling babyy, save the idea somewhere if u can, i would love for u to get to try it",
      "U and maomao finding sum interesting have soo much in common baby, suddenly the whole room has a very specific new topic",
      "One idea can be exciting without becoming a deadline tonight babyy, keep the fun part close and the plan can come later",
      "Im soo glad theres sum ur looking forward to baby, a kind creative girl like u deserves things that make her light up💕",
      "If ur in the mood to sing, draw or plan a look i hope u have the best time with it babyy, ur excitement is worth enjoying",
      "Ur interests have RANGE baby, the explanation might start at ballet and end at a miku wig and im following every step",
      "I think its soo cool how u get inspired by so many things my lovee, theres soo much for ur imagination to work with",
      "Keep the little reference that got u excited baby, it doesnt have to become a project today to be worth saving",
      "Ur soo cute when theres sum u want to talk about babyy, go on, i can handle the lore:)"
    ]
  },
  {
    "theme": "content",
    "label": "a nice little moment for u",
    "feelings": [
      "content"
    ],
    "notes": [
      "A quiet good mood with sum u love nearby sounds soo lovely baby, the day doesnt need to be dramatic for it to count",
      "I love this for u babyy, some peace, a favourite song and no need to impress anybody💕",
      "U can be content now and still have big ideas for later baby, they dont all need ur attention this afternoon",
      "A normal day with a little art or music in it can be a really nice day babyy, ur favourite things deserve ordinary days too",
      "I think ur soo lovely in the quiet moments baby, no big cosplay reveal or funny story needed",
      "If ur happy just listening for a bit then enjoy it babyy, the playlist doesnt need u to turn it into a project",
      "Ur own company deserves to feel nice baby, i hope theres a little room today to just enjoy being where u are😊",
      "Theres sum soo good about having interests u can come back to babyy, a sketchbook, miku, a character u love..familiar little joys",
      "Peaceful doesnt mean boring baby, ur still the girl with all those skills and opinions, theyre just sitting comfy for now",
      "I hope u get a little moment where u look at ur world and think yeah..i like this, u deserve that feeling babyy💕",
      "U dont need a reason to wear ur favourite colour or play ur favourite song baby, liking it is more than enough",
      "If the dayy feels okay then let okay be nice babyy, it doesnt have to compete with the most exciting day on the internet",
      "I love that theres soo much of u in the things u choose baby, ur colours, ur music, ur characters, its the loveliest mix✨",
      "A little comfort looks sooo good on ur day my lovee, u deserve more of the moments where nothing needs fixing right away",
      "Just a quiet compliment while ur here baby, i think ur such a good person to know:)",
      "A slow evening with cigarettes after sex playing quietly sounds like a perfect little moment for u babyy💕",
      "Sum boa in the background, a comfy spot and nowhere to be..i hope ur dayy feels like that baby😊"
    ]
  },
  {
    "theme": "playful",
    "label": "u can handle a little sass",
    "feelings": [
      "playful"
    ],
    "minEnergy": 2,
    "notes": [
      "U really said pretty AND funny AND can style a wig?? okay babyy leave a hobby for the rest of us",
      "Maomao has herbs, miku has songs, and u have a never ending list of things to get very normal about baby..obviously",
      "This jar is trying to be subtle about liking u babyy, unfortunately its full of compliments, not the best planning on my part:)",
      "U look soo cute in cosplay and then have the nerve to be interesting outside of it too baby, very rude to my ability to act normal",
      "If ur hobbies formed a band the setlist would be confusing but the costumes would be amazing babyy",
      "I love ur sass baby, and i take zero responsibility if this compliment makes u even sassier😊",
      "Ur miku phase has a whole system babyy, playlists, cosplay ideas, emotional investment..very impressive organizing",
      "The girl who likes maomao also has a sense of humour and opinions?? shocking baby, nobody could have seen this coming",
      "Pretty face, creative brain, soft heart and a running commentary..u came with soo many useful extras babyy💕",
      "I tried to write a roast but then remembered this is ur website baby, anyway ur interesting and im annoyed at how easy that was to prove",
      "Pulling another compliment?? good babyy, at least one of us knows what the jar is for",
      "U have the energy of someone who could explain a super specific character outfit and make me care baby, thats a skill, genuinly",
      "U cannot be sayin ur boring when ur this into cosplay babyy, the wig collection alone would like a word",
      "If miku needed a creative team u would have suggestions baby, several, with references, and i respect that sooo much",
      "Ur sense of humour and ur kind heart are the best duo babyy, a little sarcastic and sooo easy to love💕"
    ]
  },
  {
    "theme": "maomao",
    "label": "from the apothecary, apparently",
    "voice": "maomao",
    "notes": [
      "You draw, dance and style wigs. Hm. You have patience for detailed work. That's worth something. Accept the observation.",
      "Your Maomao costume is well chosen. The braids are particularly familiar. Now, if you're finished admiring it, there's a book I want to find.",
      "Kindness and a sharp tongue. Those can coexist quite comfortably. You seem to understand that already.",
      "You made a place for the things you like. Sensible. I wouldn't give up an interesting specimen to appear less peculiar.",
      "A difficult sketch? Keep it. Failed attempts still tell you something. Throwing away the evidence seems premature.",
      "You look pleased when something interests you. Good. Curiosity is far more useful than pretending to be bored.",
      "Your smile is pleasant. There, an observation. You needn't look at me as though I've discovered a new medicine.",
      "You understand wig fibres. I understand herbs. There is some satisfaction in knowing why a small detail matters.",
      "Someone described you as caring. I hope you apply a little of that care to yourself. It would save us both a lecture.",
      "You may sit here without talking. I'm reading, and you appear to have had enough conversation. An agreeable arrangement.",
      "A new leaf specimen would improve my afternoon considerably. A song or drawing might improve yours. Our interests needn't match.",
      "You have more than one talent. A single poor attempt is hardly enough evidence to dismiss all of them.",
      "Animals trust you? Hm. A useful recommendation. They generally have little interest in flattering people.",
      "Yes, the costume is pretty. And you know about the character wearing it. I find the second part rather interesting too.",
      "The enthusiasm is familiar. Someone mentions a subject you care about and suddenly there's quite a lot to say.",
      "Put the drawing somewhere safe before you rest. Losing good work to a preventable accident would be irritating.",
      "You needn't make yourself agreeable every minute. A kind person can still require everyone to leave for a while.",
      "Interesting people tend to have interests. Yours are rather extensive. I don't see why that should require an apology.",
      "Good work takes attention. So does noticing when you've had enough of it for the evening. Try to do both.",
      "Another note? Very well. You're worth the paper. Now hold this book open; the illustration on the next page is fascinating."
    ]
  }
];

export const NOTE_JAR_NOTES = groups.flatMap(({ notes, ...group }) => notes.map(text => ({
  id: createHash("sha256").update(text.normalize("NFKC").toLowerCase()).digest("hex").slice(0, 20),
  theme: group.theme, label: group.label, text,
  feelings: group.feelings ?? [], avoidFeelings: group.avoidFeelings ?? [], minEnergy: group.minEnergy ?? 0,
  voice: group.voice ?? "bestie",
  byline: group.voice === "maomao" ? "a Maomao-inspired little note" : "✦ kiriya.love",
})));
