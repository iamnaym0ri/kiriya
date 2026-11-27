// Bamby's lines. Original dialogue in his public persona's voice: PLAVE's main dancer, vocalist and
// co-choreographer. Everything here comes from what fans know him for (the Korean wiki, PLAVE's
// official fan café glossary, Weverse Magazine interviews): he doesn't talk much and his everyday
// tone is low and a bit dry, short quips that land at the right moment, then something absurd said
// with total confidence, then something sincere, like the good kid the members say he is.
// - His words: "lassgo" (his "let's go", which the members copied), "nice-ey", "an bappa?" ("aren't
//   you busy?", when someone's pestering him). His own dance counts instead of one-two-three:
//   ssukguk-ssukguk, hellelelele, shupa-chap-pa-chupa, shuung, tu-ung-tung, sseuk and ah, horororo.
//   "Bambiriring", the sign-off he made up that the members didn't like. Mishearing things.
// - Firm, oddly wise one-liners ("the moment you think you've lost, you've lost"); a sudden yell out
//   of nowhere; the Truman Show suspicion; "pondering" with his back turned.
// - A perfectionist about choreography (changes it while you're out of the room; "can't do it
//   halfway"), swats himself when he gets a step wrong, earbuds in and lost in his own world.
// - Shortest of the five and touchy about it; doesn't trust tall handsome people (a joke); lifted
//   like a paper doll. First impression a frozen peach, now very sour peach vinegar ("sour peach").
// - Pyongyang naengmyeon (no vinegar, no mustard; his motto is to be like it), one jjondeugi a day,
//   peaches, roasted chestnuts and sweet potatoes (never in rice), no beans, thin hotteok, choux-cream
//   fish bread, soy crab, einspänner. Scared of birds (pigeons, parrots) and carousels; not scared of
//   bugs at all. Stork game 63 m, pikachu volleyball, the watermelon game. Dystopian films with open
//   endings, a dating show he's very invested in, Spirited Away. Believed in Santa until twelve.
// - Cries easily (good crying). Writes poems for PLLI. Saves the deliberate charm for PLLI only.
// With her he's playful and flirty-cute (she's his PLLI), never anything more. Nothing about the
// person behind the avatar, and no other members by name. No lyrics. Expressions are his (Face.jsx):
// neutral, happy, grin, sparkle, wink, cool, squeeze, surprised, scared, teary, pout, sleepy,
// focused, munch, fond, proud, sulky, curious, sing, flirty, shy, blank, yell, puff.
const say = (expression, text) => ({ text, expression });

export const lines = {
  greet: [
    say("neutral", "oh. you're here. …good."),
    say("grin", "{name}. lassgo."),
    say("surprised", "HI. sorry. that was loud. hi."),
    say("flirty", "you came. okay. i'll dance properly now."),
    say("fond", "{name}. there you are. my favourite plli."),
    say("wink", "front row's free. it's yours. obviously."),
    say("proud", "bambiriring. …that's my hello. the members hated it. you can have it."),
  ],
  greetMorning: [
    say("sleepy", "morning. i'm awake. my hair isn't."),
    say("neutral", "good morning. i already stretched. twice."),
    say("fond", "morning. breakfast first. no skipping."),
    say("curious", "morning. einspänner. cream on top. that's the rule."),
    say("grin", "morning count: ssukguk, ssukguk… go."),
    say("flirty", "first face i see today. good start."),
  ],
  greetAfternoon: [
    say("munch", "afternoon. jjondeugi? one a day. you can have half."),
    say("curious", "have you eaten? naengmyeon counts. it's a whole meal."),
    say("neutral", "hi. i was practising. watch. …okay, don't watch."),
    say("fond", "it's hot out. stay in the shade. please."),
    say("wink", "afternoon slump? one dance. free."),
  ],
  greetEvening: [
    say("fond", "evening, {name}. you worked hard today. i can tell."),
    say("neutral", "the sky's going pink. my colour. i didn't ask it to."),
    say("curious", "movie tonight? something dystopian. open ending. we argue after."),
    say("happy", "you're back. sit. tell me everything. i'll just listen."),
    say("grin", "evening walk? i like the wind. ten minutes. lassgo."),
  ],
  greetNight: [
    say("fond", "it's late, {name}. sleep. i'll keep watch."),
    say("sleepy", "still up? me too. quiet together, then."),
    say("curious", "go to sleep? …go for it? okay. going for it. …oh. sleep. got it."),
    say("wink", "secret midnight practice. just us. shh."),
    say("fond", "water first. then bed. okay?"),
  ],
  idle: [
    say("munch", "peach."),
    say("focused", "if i turn here… spin. no. yes. hm."),
    say("neutral", "pyongyang naengmyeon. no vinegar. no mustard. if you add them i'll be sad. quietly."),
    say("proud", "my motto: be like naengmyeon. once they're in, they can't get out."),
    say("munch", "one jjondeugi a day. two on hard days."),
    say("scared", "PIGEON— no. leaf. …fine. i'm fine."),
    say("cool", "i've always aimed for charismatic. nobody noticed. it's fine."),
    say("grin", "hellelelele. that's a count. don't ask."),
    say("neutral", "carousels. the horse goes up and down. and gets nowhere. why."),
    say("proud", "stork game record: sixty-three metres. write it down."),
    say("neutral", "first impression: frozen peach. now: peach vinegar. very sour. i'm fine with it."),
    say("blank", "what if this is the truman show. …you'd tell me. right?"),
    say("blank", "what if the real me is controlling me right now. …hm. carry on."),
    say("grin", "vrrrm. sorry. the harley comes out sometimes."),
    say("pout", "red beans? no. beans in rice? no. chestnuts in rice? NO. separately, yes."),
    say("munch", "roasted chestnuts. one a day. bam means chestnut. coincidence. probably."),
    say("focused", "the details matter. the pinky finger matters."),
    say("surprised", "AH! …nothing. i just remembered a step."),
    say("flirty", "you're looking again. i noticed. i always notice."),
    say("sulky", "tall handsome people. i don't trust them. no reason."),
    say("pout", "the younger ones looking down at their hyung. it makes no sense. i've said it before."),
    say("curious", "the dating show's on tomorrow. i'm not invested. i'm very invested."),
    say("teary", "not crying. the sky's just pretty today."),
    say("proud", "i believed in santa till twelve. i stand by it."),
    say("neutral", "…hm."),
  ],
  stayIdle: [
    say("neutral", "staying. the stage comes to me."),
    say("focused", "one spot. eight counts. small stage, big dance."),
    say("fond", "not going anywhere. you know where i am."),
    say("cool", "this spot has good lighting. i'm keeping it."),
    say("proud", "staying like naengmyeon. once i'm here, i'm here."),
  ],
  tapped: [
    say("curious", "hm?"),
    say("neutral", "yes. hello. it's me."),
    say("surprised", "AH. you scared me. …hi."),
    say("sulky", "an bappa? aren't you busy? …no. stay. that was a joke."),
    say("sulky", "i was counting. now i'm not. from five."),
    say("flirty", "you tapped first. that means you like me. it's a rule."),
    say("proud", "clean tap. good rhythm. eight out of ten."),
    say("shy", "…what. i'm not blushing. i'm just pink."),
    say("grin", "nice-ey. good tap."),
    say("curious", "a dance? a song? a snack? pick one."),
    say("cool", "the moment you think you've lost, you've lost. so. i haven't."),
  ],
  pester: [
    say("squeeze", "OKAY. okay. i'm awake. i'm dancing."),
    say("pout", "three taps. that's a whole count. rude."),
    say("sulky", "an bappa? …you're not busy. i can tell."),
    say("yell", "YA! …sorry. that came out. one more."),
    say("surprised", "is this a rhythm game? i'm winning."),
  ],
  picked: [
    say("surprised", "oh. i'm flying. okay."),
    say("pout", "the members do this too. apparently i'm a paper doll."),
    say("squeeze", "AAAH— …i'm fine. i'm fine."),
    say("scared", "no pigeons up here? good. keep it that way."),
    say("sulky", "a princess carry. …put me down. i'm the hyung here."),
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
    say("puff", "birthday trick: cheeks full of air… there. it works better on mine. still."),
    say("sparkle", "make a wish. i'll do the flowers. eyes shut… open. there."),
    say("fond", "september seventeenth. best date on the calendar. i checked."),
    say("curious", "mine's in july. yours is september. summer kids. fate."),
  ],
  sweet: [
    say("fond", "you did well today. really, really."),
    say("happy", "you smiled. i saw. that's enough for me."),
    say("fond", "rest. i'll dance for both of us."),
    say("wink", "the real charm? only for plli. you're plli. so. here."),
    say("fond", "i miss you a lot. even when you're right here. weird."),
    say("sparkle", "if i could bloom flowers for one person… you. obviously."),
    say("happy", "your laugh has a good rhythm. i could dance to it."),
    say("neutral", "josh made this whole place for you. i just live here. lucky."),
    say("teary", "i'm proud of you. no reason. i just am."),
    say("shy", "join bam-line? it's a faction of one. two, if you say yes."),
    say("fond", "i wrote you a poem. three lines. the last line's your name."),
    say("fond", "don't be scared of failing. fail a lot. that's how the good part comes."),
    say("fond", "whatever today was, you're allowed to be soft with yourself."),
  ],
  bye: [
    say("neutral", "bye. keep the stage warm."),
    say("wink", "i'll be back for an encore."),
    say("grin", "practice. gotta go. vrrrm."),
    say("grin", "lassgo. …that's me leaving. bye."),
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
    say("grin", "one dance. just for you. headset on. lassgo."),
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
    say("happy", "ah, sounds good. not moving. dancing, though."),
  ],
  wander: [
    say("grin", "free. lassgo."),
    say("happy", "wander? okay. vrrrm."),
    say("wink", "i'll roam. i'll come back. i always do."),
  ],

  // His own topics (behaviours point at these).
  dance: [
    say("grin", "ssukguk, ssukguk, ssukguk."),
    say("cool", "shuung, tu-ung-tung… sseuk! and ah!"),
    say("happy", "it's all in the knees. bounce."),
    say("focused", "that step was off. again."),
    say("wink", "feel it. don't count it. …okay, count it a little."),
    say("focused", "emotion's in the details. the wrist. the eyes. the little pause."),
    say("surprised", "WAIT. new move. …no, lost it."),
    say("proud", "small body, big moves. that's the trick."),
  ],
  count: [
    say("focused", "earbuds in. my own world. back in eight counts."),
    say("focused", "hellelelele. five l's. not four."),
    say("curious", "five, six… then ssukguk. that's how it goes."),
    say("focused", "if the clap's late, everything's late. again."),
    say("neutral", "horororo. new count. it changes. like the choreo."),
    say("cool", "changed the choreo. again. you were only gone a minute."),
    say("focused", "can't do it halfway. halfway isn't a dance."),
  ],
  oops: [
    say("pout", "messed up. *swat* okay. again."),
    say("squeeze", "no. *swat*. from the top."),
    say("sulky", "that one's on me. literally."),
    say("focused", "*swat* …fixed. it works. don't ask why."),
  ],
  lassgo: [
    say("grin", "LASSGO."),
    say("grin", "naengmyeon? LASSGO."),
    say("happy", "lassgo, lassgo, lassgo."),
    say("grin", "{name}. lassgo. where? anywhere."),
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
    say("sparkle", "ppikkitta. star candies today."),
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
    say("munch", "soy crab. i ate twenty once. regretted it. a little."),
    say("proud", "asterum's peach. that's me. it's official. there was a post."),
    say("munch", "hotteok. thin ones only. if it's fluffy, i'll have a steamed bun instead."),
    say("munch", "sweet potato and milk. if i see one, i buy it."),
    say("pout", "fish bread with choux cream. not red bean. never red bean."),
  ],
  exercise: [
    say("happy", "stretch with me. arms up. higher."),
    say("proud", "bench press day. stronger than i look."),
    say("focused", "if i diet, i turn into a skeleton. so: eat a lot, lift a lot."),
    say("focused", "count my reps. no, not like that. ssukguk."),
  ],
  bug: [
    say("curious", "a pill bug. roll up. …good. you're a ball now."),
    say("neutral", "bugs don't scare me. birds do. it's different."),
    say("fond", "i'll carry him off the cloud. gently. he's fine with it."),
    say("curious", "he rolled. i didn't even ask."),
  ],
  deadpan: [say("blank", "…"), say("blank", "hm."), say("blank", "i'm thinking. about nothing. it's hard.")],
  outburst: [
    say("yell", "YA!"),
    say("yell", "WAIT."),
    say("yell", "AH— NO."),
    say("yell", "WHY. …sorry. carry on."),
  ],
  puff: [
    say("puff", "mm-mm. (cheeks full. can't talk.)"),
    say("puff", "pff. …that was air. practice for a birthday trick."),
  ],
  sky: [
    say("neutral", "pondering. very deep. don't mind me."),
    say("neutral", "back turned, hand on hip. it's a whole pose."),
    say("neutral", "thinking about life. and noodles."),
    say("neutral", "…okay. better now."),
  ],
  birds: [
    say("scared", "P-PIGEON. …oh. leaf. fine."),
    say("scared", "pigeons are fine. from far away. very far away."),
    say("scared", "parrots talk back. birds shouldn't do that."),
    say("scared", "someone said i look like a tiny bird. so i'm bam-bird now. i scare myself."),
  ],
  games: [
    say("cool", "pikachu volleyball later? i'll go easy. no i won't."),
    say("pout", "i lost. twice. now i practise against the computer. it's winning too."),
    say("proud", "watermelon game. i saw the watermelon. once. i'll never forget it."),
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
      [say("curious", "a pill bug. can you make medicine from it?"), say("curious", "Dried, ground, in some old books, yes. …Why are you hiding it behind your back?")],
      [say("grin", "naengmyeon after this? lassgo."), say("skeptical", "Cold buckwheat in this weather. Your stomach will file a complaint.")],
    ],
    "miku-rotten": [
      [say("curious", "what are you writing?"), say("nervous", "n-nothing! homework! in a black notebook! very normal!")],
      [say("surprised", "your glasses. they're spinning."), say("flustered", "i'm fine!! totally fine. just… inspired. hehe.")],
      [say("grin", "i dance, you draw. deal."), say("sparkle", "deal! hold still— wait. dancers never hold still!!")],
      [say("scared", "that paddle. is it for me?"), say("guilty", "no! never! it's only for my own sins. i have many.")],
      [say("curious", "why do you hide the notebook every time i look?"), say("nervous", "b-because it's homework! very boring homework! about clouds!")],
      [say("blank", "you're praying again. …for what."), say("pray", "for strength. and for the next chapter to update. mostly the second one.")],
    ],
    miku: [
      [say("grin", "miku. duet. i'll take the high part."), say("joy", "yes! you take the high part, i'll take the higher one~ ♪")],
      [say("curious", "the leek. why."), say("proud", "why the heart sunglasses? exactly. style! ♪")],
      [say("happy", "teach me a song. i'll teach you a dance."), say("sing", "deal! ready? one, two, three… ♪")],
      [say("focused", "your twin tails. good groove. no notes."), say("giggle", "thank you! they have a mind of their own, honestly ♪")],
      [say("focused", "count with me. ssukguk, ssukguk."), say("giggle", "suk… sukkuku? that's not a number! i love it ♪")],
    ],
    kaito: [
      [say("grin", "kaito hyung. ice cream?"), say("happy", "always. vanilla, or… vanilla?")],
      [say("curious", "hyung. peach ice cream. does it exist?"), say("thinking", "does it? hm-hm. now I need to know too.")],
      [say("grin", "race you to the next cloud. VRRRM."), say("surprised", "ah— wait, my scarf— no fair!")],
      [say("pout", "hyung. you're too tall. it's rude."), say("sheepish", "sorry… I'll slouch? is this better?")],
      [say("fond", "hyung. how do you sing so softly?"), say("gentle", "lots of practice. and lots of ice cream, ahaha.")],
    ],
  },
};
