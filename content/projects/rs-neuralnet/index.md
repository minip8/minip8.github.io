# rs-neuralnet

Inspired by 3Blue1Brown's [articles](https://www.3blue1brown.com/topics/neural-networks), motivated to learn some [Rust](https://rust-lang.org/), and fascinated by the maths behind neural nets, I decided it would be fun to implement my own little neural net in Rust!


## The neural net

### Layers

Consistent with 3b1b, I decided to go with a neural net with fully connected layers.

Each layer in the neural net takes in some input, applies a set of transformations to yield an output, which is consequently passed onto the next layer.

At a high level, each node in a layer is influenced by every node in the previous layer, thought not necessarily equally. This 'influence' can be modelled as a weighted sum of the previous layer's node outputs. Finally, a bias is added onto the resultant sum.


For the $l^{th}$ layer, let's define:
- $a^{l-1}$ to be the input of the $l^{th}$ layer
- $W^l$ to be the weights matrix
- $B^l$ to be the bias row vector
- $\sigma$ to be the activation function
- $z^l$ to be the pre-activation output
- $a^l$ to be the post-activation output


So, what the heck is the stuff that isn't just the input and output?

Well, the *other stuff* is what we use to generate $z$ and $a$.

Let $j$ denote the $j^{th}$ node in layer $l-1$.<br>
Let $k$ denote the $k^{th}$ node in layer $l$. <br>
Let $w^l_{jk}$ denote the $j^{th}$ node's weighted influence towards node $k$. <br>
Let $b^l_{k}$ denote the $k^{th}$ node's bias.

Traditionally, it should be $w^l_{kj}$ to denote the $j^{th}$ node's weighted influence towards node $k$, but in implementation, we usually use the transposed matrix.

Now, we can find $z^l_k$, the $k^{th}$ node's pre-activation value.
$$
z^l_k = \sum_{j} w^l_{jk} a^{l-1}_j + b^l_k
$$

