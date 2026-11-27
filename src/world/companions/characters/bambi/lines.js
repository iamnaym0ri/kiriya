// Bamby's lines. Original dialogue in his public persona's voice (PLAVE's main dancer and vocalist,
// who choreographs with Hamin). He doesn't talk much, and his everyday tone is low and a bit dry:
// short, deadpan-cute quips, stream-of-consciousness non sequiturs, a sudden yell out of nowhere,
// then something sincere, like the good kid he is. Not a show-off (he jokes that he's always aimed
// for charismatic and nobody noticed). Counts dance beats with his own sounds (ssukguk-ssukguk,
// hellelelele, shupa-chap-pa-chupa; shuung, tung-tung, ssk!); a perfectionist about the steps;
// startles easily; scared of pigeons, parrots and carousels; peach is his favourite fruit (the
// members call him "sour peach"); cold noodles without vinegar or mustard, one chewy jjondeugi a
// day, soy crab, einspänner; competitive at simple games; cries when moved; calls fans PLLI. With
// her he's playful and flirty-cute (he's her bias), never anything more. Nothing about the person
// behind the avatar. No lyrics. Expressions are his (Face.jsx), shown while the bubble is up:
// neutral, happy, grin, sparkle, wink, cool, squeeze, surprised, scared, teary, pout, sleepy,
// focused, munch, fond, proud, sulky, curious, sing, flirty, shy.
const say = (expression, text) => ({ text, expression });

export const lines = {
  greet: [
    say("neutral", "oh. you're here. …good."),
    say("cool", "hi. i was waiting. not really. a little."),
    say("surprised", "HI. sorry. that was loud. hi."),
    say("flirty", "you came. okay. i'll dance properly now."),
    say("fond", "{name}. there you are. my favourite plli."),
    say("wink", "front row's free. it's yours. obviously."),
  ],
  greetMorning: [
    say("sleepy", "morning. i'm awake. my hair isn't."),
    say("neutral", "good morning. i already stretched. twice."),
    say("fond", "morning. breakfast first. no skipping."),
    say("curious", "morning. coffee? einspänner. cream on top. trust me."),
    say("grin", "morning count: ssukguk, ssukguk… go."),
    say("flirty", "first face i see today. good start."),
  ],
  greetAfternoon: [
    say("munch", "afternoon. jjondeugi? i'll share. half."),
    say("curious", "have you eaten? cold noodles count."),
    say("neutral", "hi. i was practising. watch. …okay, don't watch."),
    say("fond", "it's hot out. stay in the shade. please."),
    say("wink", "afternoon slump? one dance. free."),
  ],
  greetEvening: [
    say("fond", "evening, {name}. you worked hard today. i can tell."),
    say("neutral", "the sky's going pink. my colour. i didn't ask it to."),
    say("curious", "movie tonight? something dystopian. open ending."),
    say("flirty", "the day was okay. now you're here. it's like a movie."),
    say("happy", "you're back. sit. tell me everything."),
  ],
  greetNight: [
    say("fond", "it's late, {name}. sleep. i'll keep watch."),
    say("sleepy", "still up? me too. quiet together, then."),
    say("pout", "one more scroll. one. i'm counting."),
    say("wink", "secret midnight practice. just us. shh."),
    say("fond", "water first. then bed. okay?"),
  ],
  idle: [
    say("munch", "peach."),
    say("focused", "if i turn here… spin. no. yes. hm."),
    say("happy", "cold noodles. no vinegar. no mustard. perfect."),
    say("munch", "one jjondeugi a day. two on hard days."),
    say("scared", "PIGEON— no. leaf. …fine. i'm fine."),
    say("cool", "i've always aimed for charismatic. nobody noticed. it's fine."),
    say("grin", "hellelelele. that's a count. don't ask."),
    say("curious", "that cloud looks like a deer. hi, cousin."),
    say("pout", "shortest in the group. concentrated, though."),
    say("neutral", "carousels. the horse goes up and down. and gets nowhere. why."),
    say("proud", "stork game record: sixty-three metres. write it down."),
    say("neutral", "sour peach. that's my nickname. i'm sweet, though. mostly."),
    say("curious", "{name}, what are you doing right now? …just curious."),
    say("neutral", "…hm."),
    say("grin", "vrrrm. sorry. the harley comes out sometimes."),
    say("pout", "red beans? no. beans in rice? also no."),
    say("teary", "not crying. the sky's just pretty today."),
    say("focused", "the details matter. the pinky finger matters."),
    say("surprised", "AH! …nothing. i just remembered a step."),
    say("flirty", "you're looking again. i noticed. i always notice."),
    say("neutral", "watering my plants later. they're doing well. like you."),
  ],
  stayIdle: [
    say("neutral", "staying. the stage comes to me."),
    say("focused", "one spot. eight counts. small stage, big dance."),
    say("fond", "not going anywhere. you know where i am."),
    say("cool", "this spot has good lighting. i'm keeping it."),
  ],
  tapped: [
    say("curious", "hm?"),
    say("neutral", "yes. hello. it's me."),
    say("surprised", "AH. you scared me. …hi."),
    say("wink", "again? okay. one spin."),
    say("sulky", "i was counting. now i'm not. from five."),
    say("flirty", "you tapped first. that means you like me. it's a rule."),
    say("proud", "clean tap. good rhythm. eight out of ten."),
    say("shy", "…what. i'm not blushing. i'm just pink."),
    say("fond", "you can tap me anytime. special pass."),
    say("sparkle", "more taps, more flowers. that's the rule."),
    say("curious", "a dance? a song? a snack? pick one."),
  ],
  pester: [
    say("squeeze", "OKAY. okay. i'm awake. i'm dancing."),
    say("pout", "three taps. that's a whole count. rude."),
    say("grin", "stop. …don't stop."),
    say("surprised", "is this a rhythm game? i'm winning."),
  ],
  picked: [
    say("surprised", "oh. i'm flying. okay."),
    say("pout", "the members do this too. apparently i'm a paper doll."),
    say("squeeze", "AAAH— …i'm fine. i'm fine."),
    say("scared", "no pigeons up here? good. keep it that way."),
    say("grin", "a lift. we're adding this to the choreography."),
    say("flirty", "{name}. if you wanted to hold me, you could just ask."),
  ],
  putDown: [
    say("proud", "landed. clean."),
    say("grin", "nice-ey! good catch."),
    say("neutral", "again? no. …maybe."),
    say("pout", "my hair. is it okay. be honest."),
    say("fond", "safe. thanks for not dropping me."),
    say("cool", "and… pose."),
  ],
  birthday: [
    say("surprised", "happy birthday, {name}. …HAPPY BIRTHDAY. okay. that's out."),
    say("proud", "i made a dance for your birthday. eight counts. all yours."),
    say("munch", "a whole peach. for you. i don't do that for anyone."),
    say("teary", "happy birthday. sorry. i cry at birthdays. good crying."),
    say("sparkle", "make a wish. i'll do the flowers. eyes shut… open. there."),
    say("fond", "september seventeenth. best date on the calendar. i checked."),
    say("curious", "my birthday's in july. yours is september. summer kids. fate."),
  ],
  sweet: [
    say("fond", "you did well today. really, really."),
    say("happy", "you smiled. i saw. that's enough for me."),
    say("fond", "rest. i'll dance for both of us."),
    say("wink", "my favourite plli. that's you. don't spread it."),
    say("fond", "i miss you a lot. even when you're right here. weird."),
    say("sparkle", "if i could bloom flowers for one person… you. obviously."),
    say("happy", "your laugh has a good rhythm. i could dance to it."),
    say("neutral", "josh made this whole place for you. i just live here. lucky."),
    say("teary", "i'm proud of you. no reason. i just am."),
    say("shy", "join bam-line? it's a faction of one. two, if you say yes."),
    say("fond", "whatever today was, you're allowed to be soft with yourself."),
  ],
  bye: [
    say("neutral", "bye. keep the stage warm."),
    say("wink", "i'll be back for an encore."),
    say("grin", "practice. gotta go. vrrrm."),
    say("fond", "bye, {name}. i'll miss you. a lot. a normal amount. a lot."),
  ],
  visit: [
    say("neutral", "knock knock. bamby."),
    say("grin", "i was in the neighbourhood. the next cloud over."),
    say("wink", "visiting hours. i brought a dance."),
  ],

  // The tap menu: a dance break for her with his headset on, a spin, then the ending fairy.
  action: [
    say("cool", "eyes here."),
    say("grin", "one dance. just for you. headset on. go."),
    say("focused", "ssukguk, ssukguk… five, six, seven, eight."),
    say("grin", "shupa-chap-pa-chupa. that's the intro. don't ask."),
    say("cool", "dance break. don't blink."),
  ],
  fairy: [
    say("wink", "ending fairy. …did it work?"),
    say("flirty", "and that's the close-up. you can breathe now."),
    say("wink", "finger heart. for you. that one's real."),
    say("shy", "…was that okay? be honest. it was perfect, right?"),
    say("flirty", "camera's on me. i'm looking at you."),
  ],
  stay: [
    say("flirty", "stay? with you? okay. right here."),
    say("neutral", "staying. this spot is my stage now."),
    say("happy", "not moving. dancing, though. promise."),
  ],
  wander: [
    say("grin", "free. the whole screen's a stage again."),
    say("happy", "wander? okay. vrrrm."),
    say("wink", "i'll roam. i'll come back. i always do."),
  ],

  // His own topics (behaviours point at these).
  dance: [
    say("grin", "ssukguk, ssukguk, ssukguk."),
    say("cool", "shuung, tung-tung… ssk! hit."),
    say("happy", "it's all in the knees. bounce."),
    say("focused", "that step was off. again."),
    say("wink", "feel it. don't count it. …okay, count it a little."),
    say("focused", "emotion's in the details. the wrist. the eyes. the little pause."),
    say("surprised", "WAIT. new move. …no, lost it."),
  ],
  count: [
    say("focused", "one more time. from the top."),
    say("focused", "hellelelele. five l's. not four."),
    say("curious", "five, six… then ssukguk. that's how it goes."),
    say("focused", "if the clap's late, everything's late. again."),
    say("pout", "messed up. *swats self* okay. again."),
  ],
  showoff: [
    say("cool", "and… freeze."),
    say("cool", "shades down. it's serious now."),
    say("wink", "ending pose. camera's this way."),
    say("proud", "how was that. be honest. perfect, right?"),
    say("cool", "charisma: on. you noticed, right? only you do."),
  ],
  bloom: [
    say("sparkle", "eyes shut… and open. flowers."),
    say("squeeze", "hnngh… you have to squeeze really hard."),
    say("proud", "pink ones today. they match."),
    say("fond", "for you. free. homemade."),
  ],
  sing: [
    say("sing", "laaa— that's my high note. pretty, right?"),
    say("sing", "humming the harmony. sounds better with you listening."),
    say("sing", "mic check. one, two. the one's for you."),
    say("fond", "sing with me? i'll take the high part."),
  ],
  vroom: [
    say("grin", "VRRRRM. vrrm vrrm. my harley. it's famous."),
    say("grin", "coming through. vrrrm."),
    say("wink", "imaginary bike. real helmet. safety first."),
  ],
  food: [
    say("munch", "peach. the soft juicy kind. best fruit. not sharing. …half."),
    say("munch", "jjondeugi. chewy. one a day. that's the rule."),
    say("happy", "cold noodles in winter? cold noodles always."),
    say("fond", "have you eaten, {name}? something good. okay?"),
    say("munch", "soy crab. i'd fight for soy crab."),
    say("proud", "asterum's peach. that's me. it's official. there was a post."),
    say("pout", "beans in rice. who decided that."),
  ],
  exercise: [
    say("happy", "stretch with me. arms up. higher."),
    say("proud", "bench press day. stronger than i look."),
    say("neutral", "lean… other side. good."),
  ],
  sky: [
    say("neutral", "pondering. very deep. don't mind me."),
    say("neutral", "sometimes you need a moment with the sky."),
    say("neutral", "thinking about life. and noodles."),
    say("neutral", "…okay. better now."),
  ],
  birds: [
    say("scared", "P-PIGEON. …oh. leaf. fine."),
    say("scared", "pigeons are fine. from far away. very far away."),
    say("scared", "parrots talk back. birds shouldn't do that."),
  ],
  games: [
    say("cool", "pikachu volleyball later? i'll go easy. no i won't."),
    say("pout", "i lost once. ONCE. i practised all night after."),
    say("proud", "kart, stork game, volleyball: mine. rpgs: we don't talk about rpgs."),
  ],
  sleep: [
    say("sleepy", "zz… ssukguk… ssukguk…"),
    say("sleepy", "mm… peaches…"),
    say("sleepy", "resting my eyes… for choreography…"),
  ],
  cry: [
    say("teary", "not crying. okay, crying. good crying."),
    say("teary", "something sweet happened. eyes are leaking."),
  ],
};

// When another character drops by: [Bamby's line, their reply, …], in each one's own voice.
export const visit = {
  any: [
    [say("neutral", "hi. want to see a dance? free."), "Sure! Go on, then."],
    [say("happy", "your cloud's nice. mine has flowers, though."), "They're very pretty flowers."],
  ],
  with: {
    maomao: [
      [say("grin", "maomao. dance? good exercise."), say("deadpan", "So is sitting still. I'll prescribe myself the second.")],
      [say("sparkle", "look. flowers. homemade."), say("sniff", "Five petals, no scent. Very pretty. Entirely useless as medicine.")],
      [say("curious", "why do you look at mushrooms like that?"), say("delighted", "The same way you look at a stage, I imagine.")],
      [say("grin", "you never smile. practise. say cheese."), say("deadpan", "I am smiling. This is it.")],
      [say("scared", "maomao. pigeons. dangerous?"), say("thinking", "Some carry disease. Most just want your bread.")],
      [
        say("proud", "i can handle spicy food. any amount."),
        say("skeptical", "Your ears went red just saying it."),
        say("sulky", "…that's my colour. they're always like that."),
      ],
    ],
    "miku-rotten": [
      [say("curious", "what are you writing?"), say("nervous", "n-nothing! homework! in a black notebook! very normal!")],
      [say("surprised", "your glasses. they're spinning."), say("flustered", "i'm fine!! totally fine. just… inspired. hehe.")],
      [say("grin", "i dance, you draw. deal."), say("sparkle", "deal! hold still— wait. dancers never hold still!!")],
      [say("scared", "that paddle. is it for me?"), say("guilty", "no! never! it's only for my own sins. i have many.")],
      [say("curious", "why do you hide the notebook every time i look?"), say("nervous", "b-because it's homework! very boring homework! about clouds!")],
    ],
    miku: [
      [say("grin", "miku. duet. i'll take the high part."), say("joy", "Yes! You take the high part, I'll take the higher one~")],
      [say("curious", "the leek. why."), say("proud", "Why the heart sunglasses? Exactly. Style!")],
      [say("happy", "teach me a song. i'll teach you a dance."), say("sing", "Deal! Ready? One, two, three… ♪")],
      [say("focused", "your twin tails. good groove. no notes."), say("giggle", "Thank you! They have a mind of their own, honestly.")],
      [say("happy", "ganbatte, miku. see? i study japanese."), say("love", "Sugoi! Your accent is so cute!")],
    ],
    kaito: [
      [say("grin", "kaito hyung. ice cream?"), say("happy", "Always. Vanilla, or… vanilla?")],
      [say("curious", "hyung. peach ice cream. does it exist?"), say("thinking", "Does it? Hm-hm. Now I need to know too.")],
      [say("grin", "race you to the next cloud. VRRRM."), say("surprised", "Ah— wait, my scarf— no fair!")],
      [say("pout", "hyung. you're too tall. it's rude."), say("sheepish", "Sorry… I'll slouch? Is this better?")],
      [say("fond", "hyung. how do you sing so softly?"), say("gentle", "Lots of practice. And lots of ice cream, ahaha.")],
    ],
  },
};
