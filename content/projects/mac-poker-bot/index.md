# MAC Poker Bot

Monash Association of Coding (MAC) recently hosted a poker bot hackathon, where students competed to create a poker bot over 48 hours.

Over the weekend, there was a live leaderboard with continuous games every few minutes. Crucially, all replays were publicly available.
With a bit of reverse engineering, they were also downloadable through the website's API.

I was initially not super interested in joining, since I was in the middle of [UNSW Battlecode](https://minip8.github.io/#project/unswbc26).
However, after I found out there would be some Jane Street merch, I decided to sign up as a solo team, with the creative name "merch where".

## Game Rules

The poker variant played was Nolimit Texas Hold'em.

One interesting difference was that all hands were revealed at the end of each hand.

## Making the Bot

Taking inspiration from our bot development in UNSW Battlecode, I created an arena of different playstyle opponents to hopefully create a more robust bot.

Going into the weekend, I had some initial ideas, the main one being to model the opponents' playstyles.

So, over Friday night, I had a Claude prompt running which built a bot that updates a separate model of each opponent mid-game.
This bot pleasantly had a statistically significant improvement over the base bot, and performed well on the leaderboard too (1st!).

Unfortunately, come evening time, the bot slowly drifted down the leaderboard.

Luckily I had a new bot cooking up (or so I thought), and when I uploaded the bot at night, it went back up to the top!...Until it promptly went back down.

Turns out the day-long Claude prompt was actually Claude just running a million tests and not actually developing anything useful.

So, for the final night and day, I decided to start downloading the replay data from the leaderboard.
With this data, I trained a model to play like the opponents, in hopes of improving the arena realism.

This model, along with the data, revealed that opponent bots were folding a lot to bets.
This finding was perhaps the biggest win, and also greatly influenced my final bot.

Once the final night was over, my bot was far ahead, and even reached the highest peak elo out of all other bots!

## The Tournament

Once submissions closed, I was met with the unpleasant sight of my bot very low in the leaderboard...So I pretty much lost any hope of doing well.

However, I decided to still go to the closing ceremony, where I could watch a subset of replays of which my bot had played.

Perhaps surprisingly, my bot managed to stay at the top table for the entire tournament, and ended up tie-ing first!

For the tiebreaker, my bot was put in a 1v1 against the other bot. This moment was when my bot's over-aggressive nature began to show its weakness.
My bot does well against weak opponents, trained against bots that over-fold. Unfortunately, against a stronger bot, and in an unplanned scenario of a 1v1, my bot lost significantly.

Fortunately, losing the tie break still meant I left with $300 in prize money, and perhaps more importantly - some Jane Street merch (though I will say I already had the shirt...so if there are any streeters reading this, please send us something that isn't just shirts!).

