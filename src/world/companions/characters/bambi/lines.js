// Bamby's lines. Original dialogue in his public persona's voice (PLAVE's dancer and choreographer):
// bright, quick, a little chaotic, sudden shouty bits then a sincere thank-you; insists he's very
// charismatic (nobody notices); touchy about being the shortest; counts dance beats with silly
// sounds (ssukguk-ssukguk, hellelele, shupa-chap-pa-chupa) instead of numbers; a perfectionist about
// the steps; competitive at simple games (pikachu volleyball, the stork game, kart); scared of
// pigeons and carousels; a foodie (one chewy jjondeugi a day, cold noodles without vinegar,
// peaches, chestnuts: "bam" means chestnut); cries easily when he's moved ("the sobber"); calls fans
// PLLI. With her he is playful and flirty-cute (he's her bias) and never anything more. Nothing
// about the person behind the avatar. No lyrics. Expressions are his (Face.jsx), shown while the
// bubble is up: neutral, happy, grin, sparkle, wink, cool, squeeze, surprised, scared, teary, pout,
// sleepy, focused, munch, fond, proud, sulky, curious, sing, flirty, shy.
const say = (expression, text) => ({ text, expression });

export const lines = {
  greet: [
    say("happy", "{name}~! you're here! my favourite plli is here!"),
    say("flirty", "oh, it's you. i was hoping it'd be you. it's always you."),
    say("proud", "ta-da~ bamby, arriving on stage! front row's yours."),
    say("grin", "hi hi! did you miss me? i missed you. a normal amount. okay, a lot."),
    say("surprised", "oh! hi! i was just… dancing. obviously. as usual."),
    say("wink", "bias check! …it's still me, right? good. hi!"),
  ],
  greetMorning: [
    say("grin", "good morning, {name}! i already stretched. twice. you're late~"),
    say("happy", "morning! did you sleep well? i dreamed i won kart again."),
    say("fond", "morning. breakfast first, okay? no skipping. i'm watching."),
    say("curious", "morning! coffee? i'm an einspänner person. cream on top. very charismatic."),
    say("sleepy", "mmh… morning already? i was awake. totally. eyes open. mostly."),
    say("grin", "today's first count: ssukguk, ssukguk… go!"),
    say("flirty", "good morning~ first face i see today and it's yours. lucky me."),
  ],
  greetAfternoon: [
    say("happy", "afternoon, {name}! snack time. want half my jjondeugi?"),
    say("grin", "hey hey! you're back. i was practising. watch this!"),
    say("curious", "good afternoon~ have you eaten? cold noodles count. no vinegar."),
    say("wink", "afternoon slump? i'll do a little dance. free of charge. for you only."),
    say("fond", "it's hot out there, right? stay in the shade, okay?"),
  ],
  greetEvening: [
    say("fond", "good evening, {name}. you worked hard today. i can tell."),
    say("proud", "evening~ the sky's going pink. my colour. coincidence? no."),
    say("happy", "you're back! sit, sit. tell me everything. i'm a good listener."),
    say("curious", "evening! movie night? something dystopian with an open ending?"),
    say("flirty", "the day was okay. now you're here, it's like a movie."),
  ],
  greetNight: [
    say("fond", "it's late, {name}… you should be sleeping. i'll keep watch."),
    say("sleepy", "still up? me too. let's be quiet together."),
    say("pout", "night owl, huh? okay, but one more scroll. one."),
    say("wink", "shh… everyone's asleep. secret midnight practice. just us."),
    say("fond", "bed soon, okay? drink some water first. i mean it."),
  ],
  idle: [
    say("focused", "if i turn this step into a spin… no. wait. yes. maybe."),
    say("happy", "thinking about cold noodles. no vinegar, no mustard. perfect."),
    say("munch", "one jjondeugi a day. it's not a snack. it's a lifestyle."),
    say("scared", "is that a pigeon? …no? okay. i wasn't scared."),
    say("cool", "i've always been charismatic. nobody ever notices. tragic."),
    say("grin", "hellelele~ that's how you count it. trust me."),
    say("curious", "that cloud looks like a deer. hi, cousin."),
    say("pout", "someone said i'm the shortest. i'm concentrated."),
    say("cool", "i could beat anyone at pikachu volleyball today. anyone."),
    say("proud", "my stork game record: sixty-three metres. write that down."),
    say("curious", "{name}, what are you doing right now? i'm curious. tell me."),
    say("wink", "bored? watch me. i'm very watchable."),
    say("grin", "vrrrm… sorry. my harley impression just comes out sometimes."),
    say("pout", "red beans? no thank you. everything else? yes please."),
    say("teary", "i'm not crying. the sky's just very pretty today."),
    say("focused", "the details matter. the pinky finger matters!"),
    say("happy", "nobody's watching, so… extra bounce."),
    say("curious", "carousels are suspicious. the horse goes up and down and gets nowhere."),
    say("proud", "i can handle spicy food. whatever anyone tells you. i can."),
    say("flirty", "you're looking at me again. i noticed. i always notice."),
  ],
  stayIdle: [
    say("grin", "staying right here. the stage comes to me."),
    say("focused", "one spot, eight counts. small stage, big dance."),
    say("fond", "i'm not going anywhere. you know where to find me."),
    say("cool", "this is my spot now. it has good lighting. like me."),
  ],
  tapped: [
    say("happy", "hehe, that tickles!"),
    say("grin", "you called? bamby, reporting for duty!"),
    say("surprised", "oh! you scared me. a little. not pigeon-level."),
    say("wink", "poke me again and i'll do a spin. …go on."),
    say("curious", "yes? a dance? a song? a snack recommendation?"),
    say("flirty", "you tapped me first. that means you like me. it's a rule."),
    say("proud", "that was a nice tap. eight out of ten. good rhythm."),
    say("sulky", "hey, i was mid-count! now i have to start over. from five."),
    say("shy", "w-what? i'm not blushing. my whole colour is pink. it's normal."),
    say("fond", "you can tap me anytime. that's your special pass."),
    say("sparkle", "more taps, more flowers. that's the rule."),
  ],
  pester: [
    say("squeeze", "okay okay okay! i'm awake! i'm dancing!"),
    say("pout", "three taps?! that's a whole count of eight."),
    say("grin", "hehe, stop, stop! …don't stop."),
    say("surprised", "is this a rhythm game? i'm winning, right?"),
  ],
  picked: [
    say("surprised", "whoa whoa whoa, i'm flying?!"),
    say("pout", "the members do this too. apparently i'm a paper doll."),
    say("squeeze", "aaah! okay. okay. this is fine. i'm fine."),
    say("grin", "is this a lift? are we doing choreography?!"),
    say("scared", "high up here… no pigeons, no pigeons, no pigeons…"),
    say("flirty", "{name}~ if you wanted to hold me you could just say so."),
  ],
  putDown: [
    say("proud", "landed! ten out of ten, right?"),
    say("happy", "phew. solid cloud. i love solid cloud."),
    say("focused", "good lift. we're adding it to the choreography."),
    say("cool", "and… pose!"),
    say("grin", "nice-ey~! good catch."),
    say("pout", "my hair's messy now, isn't it. be honest. still charismatic?"),
    say("fond", "safe! thanks for not dropping me."),
  ],
  birthday: [
    say("sparkle", "happy birthday, {name}!! the whole stage is yours today."),
    say("grin", "it's your birthday! i made up a dance just for you. watch!"),
    say("happy", "happy birthday~ i'd give you all my peaches. all of them."),
    say("proud", "the seventeenth of september. best date on the calendar. i checked."),
    say("teary", "happy birthday… sorry, i'm a bit teary. happy tears! sobber, remember."),
    say("sparkle", "make a wish! i'll do the flowers. eyes shut… ppi-kki-tta!"),
    say("wink", "birthday rule: you don't lift a finger. i'll do the dancing."),
    say("curious", "my birthday's in july, yours is in september. summer kids. it's fate."),
  ],
  sweet: [
    say("fond", "you make everything brighter. pink-level bright."),
    say("fond", "you're doing great, {name}. i mean it. really, really."),
    say("sparkle", "if i could bloom flowers for anyone, it'd be you."),
    say("happy", "you smiled just now. i saw. that's my favourite move."),
    say("fond", "rest when you're tired, okay? i'll keep dancing for both of us."),
    say("wink", "you're my favourite plli. don't tell the other plli."),
    say("flirty", "if you keep smiling like that i'll forget the choreography."),
    say("fond", "i miss you a lot. even when you're right here. weird, right?"),
    say("happy", "your laugh has a good rhythm. i could dance to it."),
    say("happy", "josh made this whole place for you. i just live here. lucky me."),
    say("teary", "i'm proud of you. no reason. i just am. ㅠㅠ"),
    say("shy", "join bam-line? it's a faction of one. two, if you say yes."),
    say("fond", "whatever today was like, you're allowed to be soft with yourself."),
  ],
  bye: [
    say("happy", "see you later! keep the stage warm~"),
    say("wink", "bye bye! i'll be back for an encore."),
    say("grin", "gotta go, practice! vrrrm!"),
    say("fond", "bye, {name}. i'll miss you a lot. a normal amount. a lot."),
  ],
  visit: [
    say("happy", "knock knock~ bamby's here!"),
    say("grin", "i was in the neighbourhood. the next cloud over."),
    say("wink", "visiting hours! i brought dance moves."),
  ],

  // The tap menu: a dance break for her with his headset on, a spin, then the ending fairy.
  action: [
    say("grin", "a dance? for you? always. headset on… music!"),
    say("wink", "this one's just for you. eyes here, okay?"),
    say("focused", "ssukguk, ssukguk… five, six, seven, eight!"),
    say("grin", "front row, best seat. shupa-chap-pa-chupa!"),
    say("cool", "dance break! don't blink."),
  ],
  fairy: [
    say("wink", "ending fairy~ did i make you a fan? again?"),
    say("flirty", "and that's the close-up. you're welcome."),
    say("wink", "finger heart. for you. that one's real."),
    say("shy", "…was that okay? be honest. it was perfect, right?"),
    say("flirty", "camera's on me, but i'm looking at you~"),
  ],
  stay: [
    say("flirty", "stay? with you? okay~ right here."),
    say("proud", "staying! this spot is my stage now."),
    say("happy", "okay, i won't go anywhere. i'll dance on the spot. promise."),
  ],
  wander: [
    say("grin", "free! the whole screen is my stage again!"),
    say("happy", "wander? okay, okay! vrrrm!"),
    say("wink", "i'll roam, but i'll come back. i always do."),
  ],

  // His own topics (behaviours point at these).
  dance: [
    say("grin", "ssukguk, ssukguk, ssukguk! …that's five, six, seven."),
    say("cool", "shuung, tung-tung, and… hit!"),
    say("happy", "the groove is all in the knees. bounce, bounce."),
    say("focused", "wait, that step was off. again!"),
    say("proud", "dancing on a cloud is hard. which is why i look amazing."),
    say("wink", "feel it, don't count it. …okay, count it a little."),
    say("grin", "dance with me! nobody's watching. except me. i'm cheering."),
    say("focused", "emotion in the details. the wrist, the eyes, the little pause."),
  ],
  count: [
    say("focused", "one more time from the top. it has to be perfect."),
    say("focused", "hellelele. no: hellelelele. five l's."),
    say("curious", "five, six… what comes after six? ssukguk."),
    say("focused", "if the clap's late, the whole thing's late. again."),
    say("pout", "i messed up. *swats self* okay. again."),
  ],
  showoff: [
    say("cool", "and… freeze. did you see that?"),
    say("cool", "the shades come down when it's serious."),
    say("wink", "ending pose! camera's this way~"),
    say("proud", "how was that? be honest. it was perfect, right?"),
    say("cool", "charisma: on. you noticed, right? you're the only one who does."),
  ],
  bloom: [
    say("sparkle", "eyes shut… and open! ppi-kki-tta!"),
    say("proud", "ta-da~ pink ones today. they match."),
    say("squeeze", "i have to squeeze really hard. hnngh… there!"),
    say("fond", "for you. they're free. i make them myself."),
  ],
  sing: [
    say("sing", "la-la-laa~ that's my high note. pretty, right?"),
    say("sing", "humming the harmony. it sounds better with you listening."),
    say("sing", "mic check, one, two. the one is for you."),
    say("fond", "sing with me? i'll take the high part."),
  ],
  vroom: [
    say("grin", "vrrrrm! vrrm vrrm! my harley. it's famous."),
    say("grin", "coming through! vrrrm!"),
    say("wink", "imaginary bike, real helmet. safety first!"),
  ],
  food: [
    say("munch", "a peach! the best fruit. i'm not sharing. …okay, half. for you."),
    say("munch", "jjondeugi. chewy. perfect. one a day. maybe two."),
    say("happy", "cold noodles in winter? cold noodles always."),
    say("fond", "have you eaten, {name}? something yummy, okay?"),
    say("proud", "'bam' means chestnut, you know. so roasted chestnuts are basically me."),
    say("pout", "beans in rice? why. who decided that."),
  ],
  exercise: [
    say("happy", "stretch with me! arms up, higher, like you're reaching for the stars."),
    say("proud", "bench press day. i'm stronger than i look. everyone says so. i say so."),
    say("happy", "and lean… and the other side. feels good, right?"),
  ],
  sky: [
    say("neutral", "pondering. don't mind me. very deep thoughts."),
    say("neutral", "sometimes you need a moment with the sky."),
    say("neutral", "just thinking about life. and noodles."),
    say("neutral", "…okay. i'm better now."),
  ],
  birds: [
    say("scared", "p-pigeon! …oh. it's a leaf. phew."),
    say("scared", "pigeons are fine. from far away. very far away."),
    say("scared", "parrots talk back. that's not normal for a bird. suspicious."),
  ],
  games: [
    say("cool", "pikachu volleyball later? i'll go easy on you. no i won't."),
    say("pout", "i lost once. ONCE. i practised so hard after."),
    say("proud", "kart champion, right here. rpgs… we don't talk about rpgs."),
  ],
  sleep: [
    say("sleepy", "zz… ssukguk… ssukguk…"),
    say("sleepy", "mm… peaches…"),
    say("sleepy", "just resting my eyes… for choreography…"),
  ],
  cry: [
    say("teary", "i'm not crying! okay, i'm crying. good crying."),
    say("teary", "something sweet happened and now my eyes are leaking."),
  ],
};

// When another character drops by: [Bamby's line, their reply, …], in each one's own voice.
export const visit = {
  any: [
    [say("grin", "hi hi! want to see a dance? it's free."), "Sure! Go on, then."],
    [say("happy", "your cloud is so nice! mine has flowers, though."), "They're very pretty flowers."],
  ],
  with: {
    maomao: [
      [say("grin", "maomao! want to learn a dance? it's good exercise!"), say("deadpan", "So is sitting still. I'll prescribe myself the second.")],
      [say("sparkle", "look, i made flowers! ppi-kki-tta!"), say("sniff", "Five petals, no scent. Very pretty. Entirely useless as medicine.")],
      [say("curious", "why do you look at mushrooms like that?"), say("delighted", "The same way you look at a stage, I imagine.")],
      [say("grin", "you never smile! let's practise. say cheese~"), say("deadpan", "I am smiling. This is it.")],
      [say("scared", "maomao, are pigeons dangerous?"), say("thinking", "Some carry disease. Most just want your bread.")],
      [
        say("proud", "i can handle spicy food, you know. any amount."),
        say("skeptical", "Your ears went red just saying it."),
        say("sulky", "…that's my colour. it's always like that."),
      ],
    ],
    "miku-rotten": [
      [say("curious", "what are you drawing? can i see?"), say("nervous", "n-no! it's… a cloud. two clouds. they're just friends!")],
      [say("surprised", "your glasses went all swirly. are you okay?"), say("flustered", "i'm fine!! totally fine. just… inspired. hehe~")],
      [say("grin", "i'll dance, you draw. deal?"), say("sparkle", "deal! hold still— wait. dancers never hold still!!")],
      [say("scared", "is that paddle… for me?"), say("guilty", "no! never! you're an idol. idols are off limits. it's the law.")],
      [say("curious", "why do you hide your sketchbook every time i look?"), say("nervous", "b-because it's homework! very boring homework! about clouds!")],
    ],
    miku: [
      [say("grin", "miku! duet? i'll take the high harmony!"), say("joy", "Yes! You take the high part, I'll take the higher one~")],
      [say("curious", "why do you carry a leek?"), say("proud", "Why do you carry heart sunglasses? Exactly. Style!")],
      [say("happy", "teach me a song and i'll teach you a dance!"), say("sing", "Deal! Ready? One, two, three… ♪")],
      [say("proud", "your twin tails have amazing groove."), say("giggle", "Thank you! They have a mind of their own, honestly.")],
      [say("happy", "ganbatte, miku! see? i study japanese."), say("love", "Sugoi! Your accent is so cute!")],
    ],
    kaito: [
      [say("grin", "kaito hyung! got any ice cream?"), say("happy", "Always. Vanilla, or… vanilla?")],
      [say("curious", "hyung, does peach ice cream exist?"), say("thinking", "Does it? Hm-hm. Now I need to know too.")],
      [say("grin", "race you to the next cloud! vrrrm!"), say("surprised", "Ah— wait, my scarf— no fair!")],
      [say("pout", "hyung, you're too tall. it's rude."), say("sheepish", "Sorry… I'll slouch? Is this better?")],
      [say("fond", "hyung, you sing so softly. how?"), say("gentle", "Lots of practice. And lots of ice cream, ahaha.")],
    ],
  },
};
