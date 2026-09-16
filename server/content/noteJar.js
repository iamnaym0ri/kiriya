// PRIVATE original notes: the owner's profile/Q&A and requested praise-first voice.
// Research, editorial choices and mood rules: docs/redesign/NOTE-JAR-VOICE.md.
// Content-derived IDs keep old delivered snapshots intact while new writing becomes unread.
import { createHash } from "node:crypto";

const groups = [
  {
    "theme": "art",
    "label": "ur art deserves some love",
    "notes": [
      "ur art is cool. yes, even the piece ur about to explain the flaws in. let me like it for a second.",
      "u can take something that only exists in ur head and DRAW it. sorry, that's still ridiculously cool to me.",
      "i like that u have ur own drawing style. a page looking like u made it is a good thing, btw.",
      "ur ipad didn't suddenly develop taste on its own. the person holding the pencil deserves a little credit here.",
      "digital AND traditional art. apparently one way of making pretty things wasn't enough for u. fair.",
      "that imagination of urs is one of my favourite things about u. there's always another character, colour or idea to get curious about.",
      "i think ur drawings are pretty. this is the whole note. no critique hiding in paragraph two.",
      "u have actual skills, kiriya. a drawing being difficult today doesn't mean they mysteriously left the building.",
      "a rough sketch from u is still something only u could have made. i think that's worth keeping.",
      "i love that u draw the things u care about. ur interests get to become something u made with ur own hands.",
      "procreate gets the app credit. u get the art credit. let's keep the accounting accurate.",
      "u don't need a completely original species of brush to have good ideas. ur imagination is already doing plenty.",
      "there's something so cool about knowing someone who can make their own fan art. u are that someone, btw.",
      "if all u made today was a tiny doodle, i'd still want u to feel good about it. tiny things can be lovely.",
      "ur art doesn't need to look like the most popular post on ur feed. i'm interested in what YOU want to make.",
      "i hope u keep a few drawings just because u like them. that's a good enough reason to give them space.",
      "one awkward line can't cancel out the artist behind it. ur pencil had a moment. u still have skills.",
      "the care u put into learning to draw matters. it didn't all come preinstalled with the ipad.",
      "i like that ur creativity shows up in so many ways. drawing is one of them, and it's a really lovely one.",
      "if a piece feels unfinished, u can come back to it. i still think the person making it is pretty damn cool."
    ]
  },
  {
    "theme": "cosplay",
    "label": "a little cosplay appreciation",
    "notes": [
      "ur maomao cosplay is so pretty. the green braids, the pink, the little expression. u suit that look so well.",
      "miku, maomao AND lynette? u have range. the cosplay folder is making a very strong case for u.",
      "wig styling is an actual skill and u have it. i feel like we move past that fact way too quickly.",
      "u look cute in cosplay, but i also love that u care enough about a character to bring them into ur own world.",
      "the hand-by-the-cheek maomao photo is adorable. yes, this jar has favourites. u can have the compliment anyway.",
      "ur peeking-over-the-sleeve photo has such good maomao energy. pretty, with a very believable amount of side-eye.",
      "i like ur cosplays because they're yours. the person inside the costume is a fairly major selling point.",
      "u can make a favourite character feel a little more real. i think that's such a cool thing to be able to do.",
      "i respect the wig styling. convincing synthetic hair to cooperate sounds like a whole diplomatic career.",
      "a maomao look from someone who's actually excited about maomao hits different. u bring the enthusiasm too.",
      "ur cosplay skills deserve credit on the days when one detail refuses to behave. difficult hair has opinions, apparently.",
      "miku's got a lot of versions. ur cosplay wishlist has excellent reasons for being as long as it is.",
      "u already brought lynette into ur cosplay lineup. that is a very cool thing to have actually done.",
      "the costume is cute. the care u bring to choosing the character is cute too. there's a lot to appreciate here.",
      "i hope u get a photo of ur next look that makes u go 'wait, i look GOOD'. u deserve that moment.",
      "i love that cosplay lets ur art, favourite stories and style meet in one place. it makes so much sense for u.",
      "a reference can help with a wig. it can't supply ur excitement for the character. u bring that part urself.",
      "u don't need a new cosplay to impress me. maomao, miku and lynette are already a pretty cool track record.",
      "whether the next look is another miku or a whole different world, ur curiosity is a good thing to bring with u.",
      "ur maomao photos made the front of this whole little world. very reasonable casting decision, honestly."
    ]
  },
  {
    "theme": "ballet",
    "label": "for the dancer too",
    "notes": [
      "ballet is genuinely difficult and u actually train in it. i'm impressed. u don't have to make it look easy for that to count.",
      "drawing, cosplay, ballet, singing. kiriya, that is a lot of talent for one person to be casually carrying around.",
      "i think it's cool that ur creativity can turn into movement as well as pictures. u have more than one way to say something.",
      "the patience it takes to learn ballet deserves a compliment of its own. so here it is: i'm proud of that effort.",
      "a wobbly practice doesn't make u a bad dancer. it makes u a dancer who had a wobbly practice. very different thing.",
      "u chose a hobby that takes real practice. i like that u care about things enough to keep learning them.",
      "i hope dancing gives u moments that feel good just for u. u deserve the fun part as much as the progress.",
      "ur creative range is kind of ridiculous. in a good way. the pencil and the ballet shoes both have work to do.",
      "u can love ballet and still have days where practice is annoying. affection for a hobby doesn't remove its ability to test u.",
      "one difficult bit isn't the whole story of ur dancing. there's a person with patience and interest behind that moment.",
      "i admire the effort that doesn't end up in a photo. the repeating, learning and trying again still count.",
      "ur body isn't a problem to solve for a hobby. u deserve to enjoy moving and to be treated with care while u learn.",
      "u don't need to turn a dance into an audition for being good enough. i already think ur worth cheering for.",
      "there's something lovely about loving music enough to move with it. ur interests really do understand each other.",
      "i'm cheering for the learning version of u too. u don't have to wait until everything feels polished.",
      "ballet and wig styling both ask u to be patient with tiny details. that's a very specific skill collection. i respect it.",
      "taking a break doesn't erase the work u put into dancing. the progress doesn't get offended and leave.",
      "i hope u get to feel proud of a little improvement without immediately setting urself a harder task.",
      "being willing to learn something difficult is cool. u don't need to finish learning it before i can say that.",
      "a song, a little movement, no score. sometimes enjoying urself is the whole point, and u deserve that too."
    ]
  },
  {
    "theme": "music",
    "label": "good taste, btw",
    "notes": [
      "miku, rin and len on the playlist. i see u have arranged for both joy and emotional plot twists. excellent taste.",
      "i like how much u care about music. a person who gets excited about a song is good company.",
      "u singing along because u love the song is a lovely thing. every note doesn't need to become a performance review.",
      "ur vocaloid enthusiasm is very cute. i support the deeply specific explanation of why this version matters.",
      "the aux is safe with someone who takes miku this seriously. that's my assessment and i'm sticking to it.",
      "a familiar song can just be nice company. u don't have to explain why u want to hear it again.",
      "i love that ur interests connect like this. a song becomes a drawing idea, a character becomes a cosplay. cool brain, honestly.",
      "rin and len story songs? ur playlist comes with lore. some people just have background music. u have a plot.",
      "u don't have to know every producer to have good taste. loving what u hear is a perfectly solid place to start.",
      "i think it's sweet that u make room for singing in ur life. ur enjoyment deserves a voice too.",
      "miku first, with room for rin, len and the others. i'm respecting the playlist priorities here.",
      "if u want to explain why a song is good, go on. being interested in stuff is one of the things i like about u.",
      "one song on repeat isn't a personality flaw. sometimes the chorus is simply doing its job very well.",
      "wonderlands×showtime, vivid bad squad, leo/need. u have options for the soundtrack, and i'm here for the range.",
      "u have a whole vocaloid world to enjoy. liking it this much is part of ur charm, not something to apologise for.",
      "i like that u can love a classic and get excited about something new. good taste doesn't need to pick an era forever.",
      "if a song makes u want to draw, i hope u get a chance to try the idea. ur hobbies make a good little team.",
      "u don't have to sing perfectly to deserve to sing. the part where u enjoy it matters to me too.",
      "the playlist can be dramatic. u can just be comfy. rin and len are more than capable of handling the plot for a bit.",
      "ur music taste has personality. much like the person choosing it. that's a compliment to both of u."
    ]
  },
  {
    "theme": "fandom",
    "label": "for ur very specific interests",
    "notes": [
      "u and maomao both get properly invested in the things u care about. hers happen to come in suspicious little jars. urs have better album art.",
      "i like that ur interests aren't vague. there are characters, versions, outfits and REASONS. it's fun knowing someone who cares.",
      "frieren and witch hat atelier on the cosplay wishlist makes sense. more beautiful worlds for that imagination of urs to wander into.",
      "ur favourite characters get art, music and cosplay attention. honestly, being one of ur faves sounds like a good deal.",
      "u can be deeply into a fictional world and still be a very cool real person. u are demonstrating this nicely.",
      "project sekai, genshin, star rail. ur interests have a full itinerary. i like how much there is to get excited about with u.",
      "i think it's cute that a character can make u want to draw or plan a look. u turn liking something into creativity.",
      "maomao's curiosity is a big part of her charm. i like that u have ur own things u want to know absolutely everything about.",
      "a fandom isn't an exam. u can be here because the character makes u happy. ur enthusiasm already belongs.",
      "witch hat atelier and ur love of drawing feel like a very understandable combination. i like seeing ur interests meet like that.",
      "u don't need to be less enthusiastic to look cool. caring about something is already interesting.",
      "from bungo stray dogs to miku, there's a lot going on in ur favourite-worlds department. i respect a well-stocked imagination.",
      "i like that music and idol anime are part of ur world too. singing, stories, characters. very u.",
      "ur collection of interests makes u interesting to talk to. there are so many ways to ask 'wait, tell me more'.",
      "maomao would investigate a leaf for ages. u could have a whole conversation about a favourite character. i see the appeal of both.",
      "a pretty character design being worth ur attention is reason enough. u have an artist's curiosity; it gets to enjoy itself.",
      "keeping a favourite character around on a rough day makes sense. a bit of familiar company can be nice.",
      "i hope u find something today that makes u do that little 'oh, this is SO my thing' pause. ur joy deserves material.",
      "u don't need to buy every new thing to prove u love a fandom. the enthusiasm is already very much established.",
      "there's something really lovely about someone who still gets excited by songs, stories and tiny details. that's u."
    ]
  },
  {
    "theme": "kindness",
    "label": "this is something i like about u",
    "notes": [
      "u have a kind heart and a very active commentary track. i like both. the combination is excellent.",
      "i think ur caring side is one of the prettiest things about u. yes, i'm being sincere. let me have a moment.",
      "animals liking u is a pretty convincing character reference. they have no reason to flatter u for the plot.",
      "u can be so thoughtful that it makes me stop for a second. that kind of care is a big deal, kiriya.",
      "i like that u can be sassy without losing the soft-hearted part of u. both deserve some appreciation.",
      "u make people happy. that's a real thing josh wanted this whole world to remind u of. i'm glad it's written down.",
      "ur kindness isn't just a cute extra after the talents. it's one of the main reasons u deserve to be appreciated.",
      "u deserve people who care when u talk about ur art, music or a tiny cosplay detail. ur excitement is worth listening to.",
      "i think being caring is cool. people act like it isn't sometimes. their loss, honestly.",
      "there's a lot to admire about u, but the kind soul part really matters. i hope someone is gentle with u today too.",
      "u don't need to be the funniest person in the room to be good company. i like the quiet version of u as well.",
      "i love that there's warmth behind the sass. makes the commentary considerably more endearing.",
      "u can take this compliment without doing anything for me. ur kindness isn't a subscription u have to keep paying for.",
      "being kind doesn't mean u need to say yes to everything. i like u with boundaries too.",
      "a caring person with creative hobbies and a sense of humour is a very good person to know. hi, that's u.",
      "i hope u get some of the care u give back today. u deserve to be thought about just as warmly.",
      "there's a difference between being nice for appearances and actually caring. josh described u as caring. that matters.",
      "ur company doesn't need a finished drawing, a new cosplay or a funny story attached. u being there is already something good.",
      "i like that u have room for both people and all these things u love. there's a lot of heart in ur little world.",
      "please include urself in the list of people who deserve patience. i happen to like that person quite a lot."
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
      "pretty, funny, talented. okay, save something for the rest of the character creation screen.",
      "u have enough hobbies for a small group chat and somehow they're all u. impressive. slightly alarming scheduling.",
      "ur miku interest isn't subtle. luckily being subtle was never a requirement for having excellent taste.",
      "i came here to leave a normal compliment and then remembered u do ballet AND style wigs. casual behaviour, apparently.",
      "u and maomao would start a quiet afternoon and end it discussing something extremely specific. i would bring snacks.",
      "'ur just saying that.' yes. because ur cool. fascinating how that works.",
      "ur hobbies have side quests. the side quests have reference folders. i respect the commitment to the bit.",
      "if miku had a loyalty scheme, i feel like u would understand the terms and conditions better than the staff.",
      "u being kind and sassy at once is very funny to me. warm welcome, excellent chance of commentary.",
      "i like ur sense of humour. ur opinions occasionally come with bonus entertainment and i'm not complaining.",
      "pretty AND knows what a wig needs? the character sheet is getting a little unreasonable, kiriya.",
      "this is another compliment. i know, scandalous. try to remain calm while being appreciated.",
      "maomao gets excited about herbs. u get excited about miku. everyone's got a very specific reason to lose the plot a little.",
      "ur idea of having normal interests appears to include an entire cosplay cast. honestly, keep going.",
      "u don't have to pretend to be effortlessly cool. enthusiastically nerdy is working extremely well for u.",
      "this jar has one job: remind u ur cool. u keep coming back, so apparently we have a business model.",
      "pov: u asked for one nice thing about urself and accidentally opened a site with an entire library. inconveniently appreciated.",
      "u being funny is a problem because now the rest of us have to put effort into conversation. rude. do continue.",
      "a miku song, a sketchbook, a cosplay idea. ur version of 'nothing much' has suspiciously good creative direction.",
      "u have main-character interests with excellent supporting-character casting. miku and maomao are busy in this household."
    ]
  },
  {
    "theme": "style",
    "label": "yes, ur pretty",
    "notes": [
      "u're really pretty, kiriya. i wanted one note to just say it without turning it into a whole speech.",
      "ur smile is so cute. that's it. that's the important information i needed to deliver today.",
      "i think u look lovely in ur maomao photos. there's so much charm in those little expressions.",
      "cute looks and skater fits both make sense for u. i like that ur style has room to change.",
      "purple and pink are good colours. u being the person wearing them is a pretty strong bonus.",
      "u don't need to be in cosplay to be worth looking at fondly. kiriya without a character outfit is lovely too.",
      "i like ur taste. the colours, the characters, the clothes. ur little world feels like someone interesting lives in it.",
      "u can look pretty and have approximately zero interest in socialising. these facts are completely compatible.",
      "ur smile deserves a nice comment on a random day too. it doesn't need to wait for a birthday or a good photo.",
      "i think ur cool in the way that's actually interesting: u have ur own taste and things u care about.",
      "a sweet look today and a different vibe tomorrow? i like that u give urself options. u don't need to pick one forever.",
      "ur cosplay photos are cute, but the person they belong to deserves the compliment on an ordinary day as well.",
      "there's something very endearing about u. the smile, the sass, all those interests. it's a good combination.",
      "i hope u catch a look at urself today and feel a little fondness. u deserve to be seen kindly by u too.",
      "you're pretty. ur kindness is lovely. ur humour is good. several departments are doing well here.",
      "ur taste doesn't need everyone's approval to be good. the stuff u love already makes a really nice world together.",
      "i like that u can care about how something looks AND have so many other things to say. there's a lot to u.",
      "the maomao smile photo and the sleeve photo have different vibes. both are very cute. ur range has been noted.",
      "you deserve compliments that don't secretly ask u to change something. this one's just: i think ur lovely.",
      "whatever feels like u today, i hope u get to enjoy it. i'm fond of the person, not a dress code."
    ]
  },
  {
    "theme": "rest",
    "label": "a tiny reminder, because i care",
    "notes": [
      "you're still cool with a low battery. no funny reply or finished drawing required. just u is fine.",
      "save the drawing and give ur hands a minute. i like the artist too much to only care about the picture.",
      "if u forgot ur water while getting into a project, here's a small reminder. talented people are still people who need a drink.",
      "the wig can be difficult tomorrow. ur patience deserves a break tonight if u need one.",
      "if food got pushed aside for a project, take a pause for it. i'm cheering for u, not for skipping the basics.",
      "u can enjoy a miku song without doing anything useful at the same time. simply listening is a solid plan.",
      "a quiet evening doesn't make u boring. u have plenty of personality even when none of it is currently available for comment.",
      "put the pencil down for a moment if ur hands are tired. the person who makes the art deserves looking after.",
      "u don't have to reply while ur battery's empty. i'd rather u have a little peace than force a cheerful message.",
      "rest doesn't need to make u more productive later to be worth it. i care about u having a nice moment now.",
      "one more detail can become ten more details very quickly. save where u got to; ur idea will still matter tomorrow.",
      "u can be a talented person having a do-nothing hour. i promise the talent won't take it personally.",
      "if ur eyes need a screen break, the site can wait. miku isn't going anywhere and neither is this jar.",
      "a comfortable outfit and something nice to listen to is enough of an evening plan. u don't need to impress the calendar.",
      "ur care for other people is lovely. keep a little bit for the person holding the phone too.",
      "low social battery doesn't make u bad company. it means u need a recharge. the interesting person is still there.",
      "let a project end at 'good place to pause' sometimes. it doesn't always have to end at 'absolutely exhausted'.",
      "i think ur worth looking after before everything is finished. the unfinished things can wait their turn.",
      "u don't have to fill the silence with a joke. i like u when ur just quietly existing too.",
      "if today needs the smaller version of everything, that's okay. a tiny doodle, one song, then a rest. still a day that belongs to u."
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
      "friendly reminder: u can't fairly judge ur art while only listing what went wrong. give the good bits a turn too.",
      "u wouldn't call a friend useless over one bad drawing. maybe don't hand urself the deluxe version of that treatment either.",
      "save the file before 'one more tiny change'. i believe in ur art. i do not believe in trusting a battery percentage.",
      "u have real skills. brushing off every compliment doesn't make u more humble; it just makes the compliment work overtime.",
      "a reference folder isn't a drawing yet. if u actually want to start, one messy line is enough. u can make something from there.",
      "if u keep moving the finish line, u never get to enjoy what u did. pause long enough to let a win be a win.",
      "being kind doesn't require unlimited access to ur time. u can say no and remain a very good person.",
      "the perfect idea might not show up first. u can try the interesting one anyway. ur curiosity is worth trusting.",
      "u don't need to insult ur own drawing before showing it. let someone meet the art without the apology tour.",
      "watching another tutorial is useful sometimes. trying the thing is useful too. u have hands and a very capable brain; give them a go.",
      "if ur comparing ur rough sketch to someone's finished piece, the comparison is rigged. ur work deserves a fairer look.",
      "ur cosplay wishlist is exciting. pick the bit u actually want to try first; u don't need to become the whole cast this week.",
      "stop giving every tiny mistake a starring role. ur effort and the parts u like are also in the scene.",
      "u don't have to wait until u feel wildly confident to make art. a little curiosity and a scruffy first attempt can get u started.",
      "being good at something doesn't mean every attempt is easy. u can be talented AND need another go. both are true.",
      "if u want a break, take the break. sitting there being mean to urself is not secretly a more productive third option.",
      "u can love miku without turning a cosplay plan into a punishment. make room for the bit where it's supposed to be fun.",
      "let people like ur work. u don't need to cross-examine every compliment for possible fraud.",
      "a bad practice is something to learn from, not permission to start insulting the dancer. i'm rather fond of the dancer.",
      "be honest with urself, sure. but 'honest' can include the fact that u have talent, kindness and a lot worth liking."
    ]
  },
  {
    "theme": "sad",
    "label": "still very glad ur here",
    "feelings": [
      "sad"
    ],
    "notes": [
      "if today's been rough, i still think ur lovely. the funny, creative, caring person hasn't gone anywhere.",
      "u don't have to cheer up for this note. i just wanted to remind u that ur someone worth caring about.",
      "i think ur drawings are cool. i think ur kind. none of that disappears when u have a sad day.",
      "you're still the person with all those interests and that lovely smile. u don't have to feel like that person every second.",
      "i'm sorry things feel heavy. no speech about looking on the bright side. just a little affection for u, right here.",
      "u make other people's days nicer. i hope this can give even a small bit of that care back to u.",
      "if u don't feel like being funny today, leave it. i like the person behind the jokes just as much.",
      "a familiar song or a favourite character can keep u company for a bit. they don't have to fix the day to be nice to have.",
      "u don't have to be easygoing about everything to be loved. a sad version of u is still someone lovely.",
      "i hope u can be a little softer with urself tonight. the person ur being hard on has a really good heart.",
      "one difficult day can't explain all of u. there's art, music, curiosity and so much kindness in there too.",
      "you're pretty, but u don't owe anyone a smile right now. this compliment doesn't come with instructions.",
      "if the only thing u can manage is a quiet minute, have it. i still think ur good company.",
      "pull another note if u want. wanting a little reassurance isn't embarrassing. this whole jar is here because u matter.",
      "if u want company, u can ask someone u trust without making ur feelings sound tidy first. u deserve to be heard as u are."
    ]
  },
  {
    "theme": "anxious",
    "label": "no pressure from this little note",
    "feelings": [
      "anxious"
    ],
    "notes": [
      "being nervous doesn't cancel being capable. the artist, dancer and cosplayer in u are still there.",
      "u don't have to impress this jar. i already think ur interesting, kind and really worth knowing.",
      "if ur brain is listing everything that could go wrong, here's something true right now: u have handled learning difficult things before.",
      "one uncertain moment doesn't make u bad at this. ur skills don't require u to feel confident all the time.",
      "u can ask what someone meant instead of guessing every possible meaning. ur peace is worth the small question.",
      "i like the way u care about getting things right. u deserve some patience while u figure them out too.",
      "if a project feels big, try looking at one little part. u don't have to style the whole wig in one thought.",
      "a slow reply doesn't tell the whole story of what someone thinks of u. there are lots of things u can't see from a notification.",
      "u don't have to earn kind treatment by saying the perfect thing. being a little awkward still leaves u very worth liking.",
      "ur creativity is still a good thing even when choosing what to make feels difficult. the ideas don't need sorting all at once.",
      "i think ur cool without a flawless plan. a person can be interesting while still figuring out the next step.",
      "if everything feels a bit loud, pick something familiar for a minute. the song u know, the character u love, a quieter bit of the day.",
      "u can check one thing at a time. there's no need to solve every possible version of the afternoon before it happens.",
      "you're not a disappointment because u need reassurance. ur kind heart deserves a kind answer too.",
      "this note expects exactly nothing from u. just wanted to say ur a lovely person, even when ur thoughts aren't being very lovely to u."
    ]
  },
  {
    "theme": "overwhelmed",
    "label": "one quiet bit of care",
    "feelings": [
      "overwhelmed"
    ],
    "notes": [
      "there's a lot going on, but u don't have to become less important than all of it. i care about the person doing the juggling.",
      "u can put the drawing, messages and next cosplay idea down for a bit. i still think ur creative when ur resting.",
      "if today feels like too many tabs open, this note isn't another tab asking u to do something. just a little love.",
      "you're kind, talented and probably deserving of fewer demands right now. the first two facts don't obligate u to handle everything.",
      "make one thing smaller if u can. a short reply, a tiny step, a project for later. ur effort still counts.",
      "i like u without a finished to-do list. ur company doesn't need proof that u got everything done.",
      "if u need quiet, take some. the person with all those lovely interests will still be interesting after a pause.",
      "u don't need to make being overwhelmed look graceful. i care about how ur doing more than how well u hide it.",
      "all those skills belong to u, but u don't have to use every single one today. some can just sit there looking impressive.",
      "maomao can keep her jars organised. u can leave a thing unfinished for now. nobody needs a perfect desk to deserve some care.",
      "if choosing feels like too much, one familiar song is a perfectly good place to stop choosing for a bit.",
      "u can tell someone 'i need a minute'. a caring person is allowed to need care too.",
      "ur imagination doesn't need another assignment right now. it can just enjoy a pretty picture and clock out.",
      "i think ur special for who u are, not for how much u can carry before it gets heavy.",
      "this is a small note with a small job: remind u that u matter, even when the day is demanding everything else."
    ]
  },
  {
    "theme": "angry",
    "label": "on ur side, with some sense",
    "feelings": [
      "angry"
    ],
    "notes": [
      "being annoyed doesn't make u less kind. u can have a good heart and absolutely no patience for nonsense today.",
      "ur maomao side-eye would be understandable right now. take the quiet corner if u need it; no performance required.",
      "u don't have to send the first version of the reply. let the all-caps draft cool down before it gets a public appearance.",
      "i like ur sass. i also like the version of u that protects ur own peace instead of donating the whole evening to an argument.",
      "'not today' is a complete enough answer. u don't need to submit supporting documents for a little space.",
      "u can care about someone and still be annoyed with them. feelings are inconvenient like that. ur kindness is still real.",
      "if something hurt, u don't have to make it into a joke for everyone else's comfort. ur feelings deserve a real hearing.",
      "this note has no 'calm down' speech. just a reminder that ur worth looking after while u figure out what u want to do next.",
      "whatever the situation is, u deserve a chance to respond how u actually mean to. a pause can help with that.",
      "nobody gets automatic access to ur entire social battery. especially not when it's already showing the tiny red bar.",
      "ur caring side doesn't need to resign because ur irritated. it can take a break while u set a boundary.",
      "a bad conversation doesn't get the rest of ur playlist for free. leave some of the evening for something u actually like.",
      "if the situation deserves a maomao stare, fine. just don't let it convince u that ur whole day has to belong to it.",
      "u can be pretty, talented and thoroughly unimpressed at the same time. no contradiction found.",
      "i'm fond of u with opinions. take ur time finding the words u want; u don't have to deliver them instantly."
    ]
  },
  {
    "theme": "happy",
    "label": "let me hype u a little",
    "feelings": [
      "happy"
    ],
    "notes": [
      "i hope u let urself enjoy the good mood. being happy looks good on a person with this many things to love.",
      "u have lovely art to make, good music to hear and a whole lot of personality. i'm glad ur here for the fun bits too.",
      "if u like something u made today, say so. i love the idea of u getting to be ur own fan for a minute.",
      "ur smile is cute and i hope today gives it a few good reasons to show up. no complicated message, just that.",
      "a happy kiriya with a favourite song sounds like a very good bit of the day. keep some time for it if u can.",
      "small win? i'm interested. good wig detail? interested. nice colour? absolutely interested. ur excitement counts.",
      "i like the way ur enthusiasm makes all these interests feel alive. ur favourite things have a very good fan in u.",
      "if today feels nice, u don't have to immediately turn it into a productive day. enjoying it is already a good use of it.",
      "ur kind heart, ur creativity, ur humour. there's a lot to celebrate about u on a completely normal day.",
      "put on a song u love and enjoy being u for a bit. i happen to think that's a pretty cool person to be.",
      "i hope something makes u laugh properly today. ur sense of humour deserves some good material in return.",
      "u can keep a little happy moment without proving it was a big deal. if it mattered to u, i'm glad it happened.",
      "yes, u can feel proud of ur art. this jar fully supports a little 'wait, i actually made that' moment.",
      "a lovely person having a lovely bit of their day. very pleased with this development, personally.",
      "if ur feeling good about urself, let it stay. u don't need to balance the compliment with three criticisms."
    ]
  },
  {
    "theme": "excited",
    "label": "okay, tell me everything",
    "feelings": [
      "excited"
    ],
    "notes": [
      "okay, tell me the idea. character, colours, song, wildly specific wig detail. i like u when ur interested in things.",
      "ur excitement is cute. yes, even if the explanation requires me to learn three new character names first.",
      "new cosplay idea? i'm listening. u have good taste and a very convincing amount of enthusiasm.",
      "i love that ur brain can see a character and immediately start making plans. creative little menace, affectionately.",
      "if a miku thing made u excited, i support the full explanation. i realise 'which miku' may take a minute.",
      "you're allowed a few exclamation marks about this. being pleased isn't embarrassing. i like that u care.",
      "that rush of wanting to draw something is so good. save the idea somewhere if u can; i'd love for u to get to try it.",
      "u and maomao finding something interesting have a lot in common. suddenly the room has a very specific new topic.",
      "one idea can be exciting without becoming a deadline tonight. keep the fun part close; the plan can come after.",
      "i'm glad there's something ur looking forward to. a kind, creative person deserves things that make them light up.",
      "if ur in the mood to sing, draw or plan a look, i hope u have a lovely time with it. ur enthusiasm is worth enjoying.",
      "ur interests have RANGE. the excited explanation might start at ballet and end at a miku wig. i'm following.",
      "i think it's really cool that u get inspired by so many things. there's a lot for ur imagination to work with.",
      "keep the little reference that made u excited. it doesn't need to become a project today to be worth saving.",
      "you're very cute when there's something u want to talk about. go on, i can handle the lore."
    ]
  },
  {
    "theme": "content",
    "label": "a nice little moment for u",
    "feelings": [
      "content"
    ],
    "notes": [
      "a quiet good mood and something u love nearby sounds lovely. u don't have to make the day more dramatic for it to count.",
      "i like this for u: some peace, a favourite song, no urgent need to impress anybody.",
      "u can be content and still have big ideas for later. they don't all need ur attention this afternoon.",
      "a normal day with a bit of art or music in it can be a really nice day. ur favourite things deserve ordinary space too.",
      "i think ur lovely in the quiet moments. no big cosplay reveal or funny story needed.",
      "if ur happy just listening for a bit, enjoy it. the playlist doesn't need u to turn it into a project.",
      "ur own company deserves to feel nice. i hope there's a little room today to just like being where u are.",
      "there's something really good about having interests u can come back to. a sketchbook, miku, a character u love. familiar little joys.",
      "peaceful doesn't mean boring. ur still the person with all those skills and opinions. they're just sitting comfortably.",
      "i hope u get a little moment where u look at ur world and think 'yeah, i like this'. u deserve that feeling.",
      "u don't need a reason to wear a favourite colour or listen to a favourite song. liking it is plenty.",
      "if the day feels okay, let okay be nice. it doesn't have to compete with the most exciting day on the internet.",
      "i like that there's so much of u in the things u choose. ur colours, ur music, ur characters. it's a lovely mix.",
      "a little comfort looks good on ur day. u deserve more of the bits where nothing needs fixing immediately.",
      "just a quiet compliment while ur here: i think ur a really good person to know."
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
      "u really said pretty AND funny AND can style a wig. okay. leave a hobby for someone else, perhaps.",
      "maomao has herbs. miku has songs. u have an ever-expanding list of things to get very normal about. obviously.",
      "this jar is trying to be subtle about liking u. unfortunately it's filled with compliments. poor planning on its part.",
      "u look cute in cosplay and then have the nerve to be interesting outside it too. very inconsiderate to my ability to be normal.",
      "if ur hobbies formed a band, the set list would be confusing but the costumes would be excellent.",
      "i like ur sass. i will be accepting absolutely no responsibility if this compliment encourages more of it.",
      "ur miku phase has a well-developed infrastructure. playlists, cosplay possibilities, emotional investment. impressive organisation.",
      "the person who likes maomao also has a sense of humour and opinions. shocking. nobody could have predicted this.",
      "pretty face, creative brain, soft heart, running commentary. u came with a lot of useful extras.",
      "i tried to write a roast but then remembered this is ur website. anyway, ur interesting and i'm annoyed about how easy that was to prove.",
      "pulling another compliment? good. at least one of us understands what the jar is for.",
      "u have the energy of someone who could explain a very specific character outfit and make me care. that's a skill.",
      "a person this into cosplay cannot be calling themself boring. the wig collection alone would like a word.",
      "if miku needed a creative committee, u would have suggestions. several. with references. i respect that.",
      "ur sense of humour and ur kind heart are a very good double act. slightly sarcastic, very easy to like."
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
