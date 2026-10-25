# RankFlow – Real-Time Leaderboard and Ranking Engine

**Course / Subject:** Data Structures and Algorithms (DSA)  
**Technologies:** HTML5, CSS3, JavaScript (Vanilla ES6+), and C++14/C++17 (Standalone)  

---

## 1. Problem Statement

> **Problem Statement:**  
> Real-Time Leaderboard and Ranking Engine: Maintain scores for frequently updated users using heaps, balanced trees, or suitable combinations. Support top-K retrieval, score updates, ranking queries, and performance comparisons under repeated updates.

---

## 2. DSA Overview & Core Architectural Concepts

High-throughput gaming platforms, live competitive programming websites, and streaming leaderboards face a classic data structure tradeoff:
Hundreds of thousands of users submit score adjustments per second, while millions of viewers query the **Top-K leaderboard** or check their **exact rank**.

A naive or partial data structure inevitably creates severe performance bottlenecks:

```
+-----------------------------------------------------------------------------------------+
|                                LEADERBOARD ARCHITECTURES                                |
+-----------------------------------------------------------------------------------------+
| Approach 1: Naive Hash Map + Array Sort                                                 |
|   • Score Update:  O(1) [Fast]                                                          |
|   • Top-K Query:   O(N log N) [Full Sort - Catastrophic on large N]                     |
|   • Rank Query:    O(N) [Linear scan of all players]                                    |
|                                                                                         |
| Approach 2: Indexed Binary Max-Heap + Hash Map                                          |
|   • Score Update:  O(log N) [Sift-Up / Sift-Down via Hash Map Index Lookup]             |
|   • Top-K Query:   O(K log N) or O(1) for Top-1 [Fast]                                  |
|   • Rank Query:    O(N) [HEAPS LACK TOTAL ORDER - Searching arbitrary rank takes O(N)]  |
|                                                                                         |
| Approach 3: Augmented Balanced Search Tree (Order Statistic AVL Tree) [Optimal]         |
|   • Subtree Sizes: Each node stores subtreeSize = 1 + size(left) + size(right)          |
|   • Score Update:  O(log N) [Delete old node, re-insert with new score, AVL rebalance]  |
|   • Top-K Query:   O(K + log N) [Reverse in-order traversal of top K nodes]             |
|   • Rank Query:    O(log N) [Accumulate left subtree sizes on path to root]             |
|   • Select Rank:   O(log N) [Order statistic select descending left/right subtrees]     |
+-----------------------------------------------------------------------------------------+
```

### A. Why Heaps Alone Are Insufficient for Leaderboards
A Binary Max-Heap guarantees that `parent >= children`. However, it establishes only a **partial order**, not a **total order**:
- It is impossible to know whether the left child or the right child holds higher scores without checking both.
- An arbitrary element's rank cannot be determined from its index in the heap array.
- Finding user $X$'s exact rank requires scanning all $N$ elements to count how many are greater ($O(N)$).
- Therefore, Heaps alone cannot efficiently support `getRank(userId)` or `getByRank(k)`.

### B. The Order Statistic Balanced Tree (Augmented AVL Tree)
By augmenting an AVL Tree so that every node stores `subtreeSize`:
1. **Subtree Size Invariant:**
   $$\text{subtreeSize}(u) = 1 + \text{subtreeSize}(u.\text{left}) + \text{subtreeSize}(u.\text{right})$$
2. **Rotations in $O(1)$:**
   During standard single and double AVL rotations (Left-Rotate, Right-Rotate), `subtreeSize` and `height` are updated immediately in $O(1)$ time by recalculating from direct children.
3. **Exact Rank Query (`getRank(userId)`) in $O(\log N)$:**
   - With left subtree containing higher scores, the number of users strictly better than $u$ inside $u$'s subtree is $\text{size}(u.\text{left})$.
   - Walking up to the root: whenever the current node is the right child of its parent, all nodes in $\text{parent}.\text{left}$ plus the parent itself are also strictly higher.
   - Total time: proportional to tree height $h \le 1.44 \log_2(N) = O(\log N)$.
4. **Order Statistic Select (`getByRank(k)`) in $O(\log N)$:**
   - Given rank $k$, inspect $L = \text{size}(\text{curr}.\text{left})$.
   - If $k \le L$, search left subtree.
   - If $k = L + 1$, the current node is the exact player at rank $k$.
   - If $k > L + 1$, search right subtree with target $k - (L + 1)$.

### C. Hash Map + Node Pointer Pairing
To achieve $O(1)$ entry points into the balanced tree:
- An auxiliary Hash Map stores `userId -> AVLNode*` (C++) or `Map<string, AVLNode>` (JavaScript).
- To update user $X$:
  1. Locate their node in $O(1)$ via Hash Map.
  2. Remove the node from the AVL tree in $O(\log N)$.
  3. Update score and timestamp.
  4. Re-insert the node in $O(\log N)$ and rebalance upwards.
- **Overall Update Time: $O(\log N)$.**

### D. Deterministic Tie-Breaking
When two players have the exact same score, ties are deterministically resolved:
1. Primary criterion: **Score (Descending)**
2. Secondary criterion: **Last Updated Timestamp (Ascending)** (earlier achiever ranks higher)
3. Tertiary criterion: **User ID (Lexicographical)**

---

## 3. Time & Space Complexity Analysis

| Operation / Query | Naive Hash Map + Array Sort | Indexed Max-Heap + Hash Map | Order Statistic AVL Tree (Optimal) |
|---|---|---|---|
| **Score Update (`updateScore`)** | $O(1)$ | $O(\log N)$ | **$O(\log N)$** |
| **Top-1 Inspection (`peekMax`)** | $O(N)$ or $O(1)$ cached | $O(1)$ | **$O(\log N)$ or $O(1)$** |
| **Top-K Retrieval (`getTopK`)** | $O(N \log N)$ (or $O(N \log K)$) | $O(K \log N)$ | **$O(K + \log N)$** |
| **Exact Rank Query (`getRank`)** | $O(N)$ [Linear scan] | $O(N)$ [Linear scan] | **$O(\log N)$ [Instant logarithmic]** |
| **Select by Rank (`getByRank`)** | $O(N \log N)$ | $O(N)$ | **$O(\log N)$ [Order Statistic Select]** |
| **Space Complexity** | $O(N)$ | $O(N)$ | **$O(N)$** |

---

## 4. Directory Structure

```
ds_project/
├── index.html              — Interactive Web UI (Podium table, live stream, telemetry, benchmark suite)
├── style.css               — Clean, responsive professional CSS design system
├── script.js               — Complete JS engine (AVL Tree, Indexed Heap, live simulator, CSV export)
├── leaderboard_engine.cpp  — Standalone C++14/C++17 high-throughput ranking engine
├── leaderboard_engine.exe  — Compiled high-performance benchmark binary (MinGW GCC)
└── README.md               — Project documentation, algorithmic foundations, benchmarks, and Viva prep
```

---

## 5. How to Run

### A. Web Application (Zero Installation)
1. Open [`index.html`](file:///c:/Users/Rohan/Desktop/ds_project/index.html) directly in any modern web browser (Chrome, Edge, Firefox).
2. Fully functional offline:
   - Click **"Start Live Stream"** to begin simulating real-time player score updates.
   - Use the **Manual Score Update** form to test specific players.
   - Enter player IDs in **"Exact Rank Query"** to see instant $O(\log N)$ rank calculation and surrounding ranks.
   - Click **"Run Comparison Benchmark"** to test 10,000 updates side-by-side across all 3 data structures.
   - Click **"Export Leaderboard (CSV)"** to download the full ranked dataset.

### B. Standalone C++ Program
Compile with any C++14 or C++17 compiler:
```bash
g++ -std=c++14 -O2 leaderboard_engine.cpp -o leaderboard_engine.exe
```

Run interactive demo and automated benchmark:
```bash
.\leaderboard_engine.exe
```

Or pass custom workload parameters:
```bash
# Syntax: .\leaderboard_engine.exe [num_users] [num_updates] [top_k] [mode]
.\leaderboard_engine.exe 10000 50000 10 benchmark

# Stress test 20,000 players with 100,000 updates:
.\leaderboard_engine.exe 20000 100000 25 benchmark

# Run in quick interactive demo mode:
.\leaderboard_engine.exe 10 0 5 interactive
```

---

## 6. Empirical Benchmark Results (C++ Benchmark)

### Experiment: 5,000 Users, 20,000 Repeated Updates, Top-10 Retrieval, 1,000 Rank Queries
```text
==============================================================================
 STRATEGY & DATA STRUCTURE PERFORMANCE COMPARISON SUMMARY
==============================================================================
Data Structure              Updates (ms)   Avg/Upd (us)   Top-K (ms)   RankQry (ms)
------------------------------------------------------------------------------
Order Statistic AVL Tree            9.33        0.47 us         0.00        0.00 ms
Indexed Max-Heap                    3.90        0.19 us         0.00        6.19 ms
Naive Map + Sort                    2.00        0.10 us         0.10       22.04 ms
------------------------------------------------------------------------------

Conclusion:
  - Binary Heap and Hash Map are fast on score updates, but degrade drastically
    during ranking queries (O(N) search per query).
  - The Order Statistic AVL Tree maintains strict O(log N) performance across
    BOTH score updates and point rank queries with sub-microsecond latency.
==============================================================================
```

---

## 7. DSA Viva Preparation (Questions & Answers)

**Q1: Why is an augmented balanced binary search tree better than a heap for a real-time leaderboard?**  
*Answer:* A heap only provides a partial order: each node is greater than its children, but relative ordering between subtrees is unknown. While a heap retrieves the maximum in $O(1)$ and updates in $O(\log N)$, answering "What is User X's rank?" or "Who is at rank #50?" requires an $O(N)$ linear traversal. An Order Statistic Balanced BST augments each node with subtree sizes, delivering $O(\log N)$ for updates, $O(K + \log N)$ for Top-K, and $O(\log N)$ for exact ranking.

**Q2: How is the subtree size maintained during AVL tree rotations?**  
*Answer:* Subtree size is purely a function of a node's immediate children:
$$\text{subtreeSize}(u) = 1 + \text{subtreeSize}(u.\text{left}) + \text{subtreeSize}(u.\text{right})$$
During a rotation (e.g. Right Rotation on $Y$ where $X = Y.\text{left}$ becomes the new root), only the sizes of $Y$ and $X$ change. By recomputing $Y$'s size first, and then $X$'s size using this formula, the invariant is restored in $O(1)$ time without traversing the rest of the tree.

**Q3: How does the algorithm determine a user's exact rank in $O(\log N)$?**  
*Answer:* If the tree is organized such that the left subtree holds higher scores:
1. We start at the target user's node. All nodes in its left child have higher scores, giving an initial count of $\text{size}(\text{node}.\text{left})$.
2. We walk upwards along parent pointers to the root. Whenever the current node is the **right child** of its parent, the parent and all nodes in the parent's left subtree are strictly higher than the user.
3. We add $(1 + \text{size}(\text{parent}.\text{left}))$ to the count.
4. Once the root is reached, $\text{Rank} = \text{count} + 1$. The path length is bounded by tree height $O(\log N)$.

**Q4: What is the purpose of the Hash Map in this engine?**  
*Answer:* A standard BST search by user ID would take $O(N)$ if the tree is ordered by score. By storing a Hash Map mapping `userId -> AVLNode*`, we achieve $O(1)$ direct access to any user's node in memory. Updating a user's score then simply removes that node, updates its score, and reinserts it in $O(\log N)$.

**Q5: How are score ties resolved deterministically?**  
*Answer:* If two players achieve the same numerical score (e.g., both have 9,500 points), the comparator checks their `lastUpdated` timestamp. The player who reached the score earlier ranks higher. If timestamps are identical, their alphanumeric `userId` string acts as the final tie-breaker, guaranteeing a strict, total ordering without duplicate keys.

**Q6: What is the difference between Top-K retrieval and a Rank Query?**  
*Answer:*
- **Top-K Retrieval:** Finds the $K$ players with the highest scores overall (e.g. "Who are the top 10 players on the server?"). In an AVL tree, this is an in-order traversal of the first $K$ nodes in $O(K + \log N)$.
- **Rank Query:** Given a specific player ID (e.g. "What is Player 'Alex_101's current rank?"), it computes their exact 1-based numerical standing among all $N$ players in $O(\log N)$.

**Q7: How do real-world production systems (like Redis) implement real-time leaderboards?**  
*Answer:* Redis implements its Sorted Sets (`ZSET`) using a combination of a **Hash Table** (for $O(1)$ element-to-score lookups) and a **Skip List with Spans** (Ranked Skip List). The span on each forward pointer records how many nodes are skipped, allowing both updates and rank queries (`ZREVRANK`, `ZREVRANGE`) in $O(\log N)$ expected time, functionally equivalent to an Order Statistic Tree.
