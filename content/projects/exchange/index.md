# cpp-exchange

Initially interested in C++ for its usefulness in competitive programming, I began exploring more after being lured in by [cpp-con](https://cppcon.org)'s [YouTube](https://youtube.com) recommendations.

Here unfolded the world of clean, performant C++ programming, which hopefully is [reflected](https://en.cppreference.com/cpp/meta/reflection) in this project.

## Tools

Always hearing the term "modern C++", I decided to go as modern as possible!

* C++26
* g++-16
* CMake 4.4.0

## Engine Architecture

### Order

An `Order` is a simple struct that holds:

* `id`
* `price`
* `time`
* `quantity`
* `side`

### PriceLevel

A `PriceLevel` is a simple struct that holds:

* `std::vector<Order>`
* `price`

### OrderBook

Here, despite the name `OrderBook`, we give the book the ability to also `match` `Order`s when they are processed into the `OrderBook`.

In each `OrderBook`, we have a `std::vector<PriceLevel>`, sorted by `PriceLevel`'s `price`. We have two separate `std::vector`s, one for buys, one for sells.

Inside each `PriceLevel`'s `std::vector<Order>`, we always insert `Order`s to the back, and `match` from the front, so time priority is naturally respected.

The heavy usage of `std::vector` over other containers such as `std::map` or `std::list` is attributed to writing code that is cache-friendly. The contiguous layout of memory of a `std::vector` allows for blazingly fast iteration through each element of a `std::vector`, made possible by the [CPU prefetcher](https://en.wikipedia.org/wiki/Cache_prefetching).

Node-based containers, such as `std::map`, have the elements scattered across memory, which causes iteration through the container to be much slower since the CPU cannot effectively prefetch memory.

Unfortunately, if we wish to lookup an `Order` by its `id`, we must know the `price` and `side` to retrieve the `PriceLevel`. For now, we resort to a `std::unordered_map<OrderId, std::pair<OrderPrice, OrderSide>>`. `GCC`'s implementation of a `std::unorederd_map` has node allocations, which we hopefully want to avoid in the future with some other implementations!

### Matching Engine (`ME`)

Nothing very interesting here, just another few `std::unordered_map`s to the respective `OrderBook`s. Same thing as above, hopefully they can be replaced for a more efficient implementation some time in the future.
