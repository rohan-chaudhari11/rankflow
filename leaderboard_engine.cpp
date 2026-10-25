/**
 * ============================================================================
 * RankFlow – Real-Time Leaderboard and Ranking Engine (C++ DSA Implementation)
 * ============================================================================
 * 
 * Problem Statement:
 *   Real-Time Leaderboard and Ranking Engine: Maintain scores for frequently
 *   updated users using heaps, balanced trees, or suitable combinations.
 *   Support top-K retrieval, score updates, ranking queries, and performance
 *   comparisons under repeated updates.
 * 
 * Data Structures & Algorithms (DSA) Concepts:
 *   1. Order Statistic Balanced Binary Search Tree (AVL Tree with Subtree Sizes)
 *      - O(log N) insert, delete, and score update
 *      - O(log N) exact rank query: getRank(userId)
 *      - O(log N) select by rank: getByRank(k)
 *      - O(K + log N) Top-K retrieval
 *   2. Indexed Max-Heap + Hash Map (Priority Queue with Fast Key Update)
 *      - O(log N) score update with sift-up / sift-down
 *      - O(1) peek top-1, O(K log N) Top-K retrieval
 *      - O(N) rank query (demonstrates heap's partial-order limitation)
 *   3. Baseline Naive Array + Hash Map
 *      - O(1) score update
 *      - O(N log N) Top-K retrieval (full sort)
 *      - O(N) rank query (linear scan)
 *   4. Empirical Benchmark Suite under High-Frequency Repeated Updates
 * 
 * Compilation:
 *   g++ -std=c++14 -O2 leaderboard_engine.cpp -o leaderboard_engine
 * 
 * Execution:
 *   ./leaderboard_engine
 *   ./leaderboard_engine [num_users] [num_updates] [top_k] [test_mode]
 *   Example: ./leaderboard_engine 10000 50000 10 benchmark
 * ============================================================================
 */

#include <iostream>
#include <vector>
#include <string>
#include <unordered_map>
#include <algorithm>
#include <chrono>
#include <iomanip>
#include <random>
#include <cassert>

// ----------------------------------------------------------------------------
// User & Score Record
// ----------------------------------------------------------------------------
struct UserRecord {
    std::string userId;
    long long score;
    long long lastUpdated; // Tie-breaker timestamp: earlier update ranks higher

    UserRecord() : userId(""), score(0), lastUpdated(0) {}
    UserRecord(const std::string& id, long long s, long long t)
        : userId(id), score(s), lastUpdated(t) {}

    // Comparator: Higher score first; if equal, earlier timestamp first; then userId
    bool operator>(const UserRecord& other) const {
        if (score != other.score) return score > other.score;
        if (lastUpdated != other.lastUpdated) return lastUpdated < other.lastUpdated;
        return userId < other.userId;
    }

    bool operator<(const UserRecord& other) const {
        if (score != other.score) return score < other.score;
        if (lastUpdated != other.lastUpdated) return lastUpdated > other.lastUpdated;
        return userId > other.userId;
    }

    bool operator==(const UserRecord& other) const {
        return userId == other.userId;
    }
};

// ============================================================================
// 1. Order Statistic Balanced Binary Search Tree (Augmented AVL Tree)
// ============================================================================
// Every node maintains:
//   - height: for AVL balance maintenance (|height(L) - height(R)| <= 1)
//   - subtreeSize: count of nodes in the subtree rooted at this node
//
// Left subtree contains STRICTLY GREATER elements (Higher score / better rank).
// Right subtree contains STRICTLY LESSER elements.
// This allows:
//   - getRank(userId): O(log N) by traversing up to root and accumulating sizes
//   - getByRank(k): O(log N) by descending left/right based on subtreeSize
// ============================================================================

struct AVLNode {
    UserRecord record;
    int height;
    int subtreeSize;
    AVLNode* left;
    AVLNode* right;
    AVLNode* parent;

    AVLNode(const UserRecord& rec)
        : record(rec), height(1), subtreeSize(1), left(nullptr), right(nullptr), parent(nullptr) {}
};

class OrderStatisticAVLTree {
private:
    AVLNode* root;
    std::unordered_map<std::string, AVLNode*> userMap;

    int getHeight(AVLNode* node) const {
        return node ? node->height : 0;
    }

    int getSize(AVLNode* node) const {
        return node ? node->subtreeSize : 0;
    }

    void updateNode(AVLNode* node) {
        if (!node) return;
        node->height = 1 + std::max(getHeight(node->left), getHeight(node->right));
        node->subtreeSize = 1 + getSize(node->left) + getSize(node->right);
    }

    int getBalanceFactor(AVLNode* node) const {
        return node ? getHeight(node->left) - getHeight(node->right) : 0;
    }

    AVLNode* rotateRight(AVLNode* y) {
        AVLNode* x = y->left;
        AVLNode* T2 = x->right;
        AVLNode* p = y->parent;

        x->right = y;
        y->parent = x;

        y->left = T2;
        if (T2) T2->parent = y;

        x->parent = p;
        if (p) {
            if (p->left == y) p->left = x;
            else p->right = x;
        } else {
            root = x;
        }

        updateNode(y);
        updateNode(x);
        return x;
    }

    AVLNode* rotateLeft(AVLNode* x) {
        AVLNode* y = x->right;
        AVLNode* T2 = y->left;
        AVLNode* p = x->parent;

        y->left = x;
        x->parent = y;

        x->right = T2;
        if (T2) T2->parent = x;

        y->parent = p;
        if (p) {
            if (p->left == x) p->left = y;
            else p->right = y;
        } else {
            root = y;
        }

        updateNode(x);
        updateNode(y);
        return y;
    }

    void rebalanceUpwards(AVLNode* curr) {
        while (curr) {
            updateNode(curr);
            int balance = getBalanceFactor(curr);

            // Left Heavy
            if (balance > 1) {
                if (getBalanceFactor(curr->left) < 0) {
                    rotateLeft(curr->left);
                }
                curr = rotateRight(curr);
            }
            // Right Heavy
            else if (balance < -1) {
                if (getBalanceFactor(curr->right) > 0) {
                    rotateRight(curr->right);
                }
                curr = rotateLeft(curr);
            }

            curr = curr->parent;
        }
    }

    void destroyTree(AVLNode* node) {
        if (!node) return;
        destroyTree(node->left);
        destroyTree(node->right);
        delete node;
    }

    void collectTopK(AVLNode* node, int& remaining, std::vector<UserRecord>& result) const {
        if (!node || remaining <= 0) return;
        // In-order traversal of left child first because left child contains HIGHER scores
        collectTopK(node->left, remaining, result);
        if (remaining > 0) {
            result.push_back(node->record);
            remaining--;
            collectTopK(node->right, remaining, result);
        }
    }

public:
    OrderStatisticAVLTree() : root(nullptr) {}

    ~OrderStatisticAVLTree() {
        destroyTree(root);
    }

    int size() const {
        return getSize(root);
    }

    bool contains(const std::string& userId) const {
        return userMap.find(userId) != userMap.end();
    }

    long long getScore(const std::string& userId) const {
        auto it = userMap.find(userId);
        if (it != userMap.end()) {
            return it->second->record.score;
        }
        return -1;
    }

    // Insert new user record: O(log N)
    void insert(const UserRecord& rec) {
        AVLNode* newNode = new AVLNode(rec);
        userMap[rec.userId] = newNode;

        if (!root) {
            root = newNode;
            return;
        }

        AVLNode* curr = root;
        AVLNode* parent = nullptr;

        while (curr) {
            parent = curr;
            // Higher score goes to LEFT
            if (rec > curr->record) {
                curr = curr->left;
            } else {
                curr = curr->right;
            }
        }

        newNode->parent = parent;
        if (rec > parent->record) {
            parent->left = newNode;
        } else {
            parent->right = newNode;
        }

        rebalanceUpwards(parent);
    }

    // Remove existing node: O(log N)
    void removeNode(AVLNode* node) {
        if (!node) return;
        userMap.erase(node->record.userId);

        AVLNode* nodeToBalance = nullptr;

        // Case 1: Node has 0 or 1 child
        if (!node->left || !node->right) {
            AVLNode* child = node->left ? node->left : node->right;
            AVLNode* p = node->parent;

            if (child) child->parent = p;

            if (!p) {
                root = child;
            } else if (p->left == node) {
                p->left = child;
            } else {
                p->right = child;
            }

            nodeToBalance = p;
            delete node;
        }
        // Case 2: Node has two children
        else {
            // Find in-order successor (minimum in right subtree)
            AVLNode* successor = node->right;
            while (successor->left) {
                successor = successor->left;
            }

            // Copy successor record to current node
            node->record = successor->record;
            userMap[node->record.userId] = node;

            // Remove successor
            AVLNode* succChild = successor->right;
            AVLNode* succParent = successor->parent;

            if (succChild) succChild->parent = succParent;

            if (succParent->left == successor) {
                succParent->left = succChild;
            } else {
                succParent->right = succChild;
            }

            nodeToBalance = succParent;
            delete successor;
        }

        rebalanceUpwards(nodeToBalance);
    }

    // Update score of user: O(log N)
    void updateScore(const std::string& userId, long long newScore, long long timestamp) {
        auto it = userMap.find(userId);
        if (it != userMap.end()) {
            removeNode(it->second);
        }
        insert(UserRecord(userId, newScore, timestamp));
    }

    // Query 1-based exact rank of user: O(log N)
    // Counts how many nodes are strictly greater than this user + 1
    int getRank(const std::string& userId) const {
        auto it = userMap.find(userId);
        if (it == userMap.end()) return -1;

        AVLNode* node = it->second;
        // All nodes in node->left have strictly higher scores
        int rank = getSize(node->left) + 1;

        AVLNode* curr = node;
        while (curr->parent) {
            AVLNode* p = curr->parent;
            // If curr is the right child, then parent and parent->left are all higher
            if (p->right == curr) {
                rank += 1 + getSize(p->left);
            }
            curr = p;
        }
        return rank;
    }

    // Query user record occupying 1-based rank k: O(log N)
    UserRecord getByRank(int k) const {
        if (k <= 0 || k > size()) return UserRecord();

        AVLNode* curr = root;
        while (curr) {
            int leftCount = getSize(curr->left);
            if (k <= leftCount) {
                curr = curr->left;
            } else if (k == leftCount + 1) {
                return curr->record;
            } else {
                k -= (leftCount + 1);
                curr = curr->right;
            }
        }
        return UserRecord();
    }

    // Retrieve Top-K highest scoring users: O(K + log N)
    std::vector<UserRecord> getTopK(int k) const {
        std::vector<UserRecord> result;
        result.reserve(k);
        int remaining = k;
        collectTopK(root, remaining, result);
        return result;
    }
};

// ============================================================================
// 2. Indexed Max-Heap + Hash Map (Priority Queue with Fast Key Updates)
// ============================================================================
// Maintains:
//   - std::vector<UserRecord> heapArray
//   - std::unordered_map<std::string, int> indexMap (userId -> index in heap)
//
// Operations:
//   - updateScore: O(log N) via siftUp / siftDown
//   - getTop1: O(1)
//   - getTopK: O(K log N) by extracting top K into temp list and restoring
//   - getRank: O(N) linear scan (Heap is only a partial order!)
// ============================================================================

class IndexedMaxHeap {
private:
    std::vector<UserRecord> heap;
    std::unordered_map<std::string, int> indexMap;

    void swapNodes(int i, int j) {
        std::swap(heap[i], heap[j]);
        indexMap[heap[i].userId] = i;
        indexMap[heap[j].userId] = j;
    }

    void siftUp(int idx) {
        while (idx > 0) {
            int parent = (idx - 1) / 2;
            if (heap[idx] > heap[parent]) {
                swapNodes(idx, parent);
                idx = parent;
            } else {
                break;
            }
        }
    }

    void siftDown(int idx) {
        int n = static_cast<int>(heap.size());
        while (true) {
            int largest = idx;
            int left = 2 * idx + 1;
            int right = 2 * idx + 2;

            if (left < n && heap[left] > heap[largest]) {
                largest = left;
            }
            if (right < n && heap[right] > heap[largest]) {
                largest = right;
            }

            if (largest != idx) {
                swapNodes(idx, largest);
                idx = largest;
            } else {
                break;
            }
        }
    }

public:
    int size() const {
        return static_cast<int>(heap.size());
    }

    bool contains(const std::string& userId) const {
        return indexMap.find(userId) != indexMap.end();
    }

    void insert(const UserRecord& rec) {
        int idx = static_cast<int>(heap.size());
        heap.push_back(rec);
        indexMap[rec.userId] = idx;
        siftUp(idx);
    }

    void updateScore(const std::string& userId, long long newScore, long long timestamp) {
        auto it = indexMap.find(userId);
        if (it == indexMap.end()) {
            insert(UserRecord(userId, newScore, timestamp));
            return;
        }

        int idx = it->second;
        UserRecord oldRec = heap[idx];
        heap[idx].score = newScore;
        heap[idx].lastUpdated = timestamp;

        if (heap[idx] > oldRec) {
            siftUp(idx);
        } else {
            siftDown(idx);
        }
    }

    // Top-1 peak: O(1)
    UserRecord getTop() const {
        if (heap.empty()) return UserRecord();
        return heap[0];
    }

    // Top-K retrieval: O(K log N)
    // Uses an auxiliary heap over indices to non-destructively extract top K
    std::vector<UserRecord> getTopK(int k) const {
        std::vector<UserRecord> result;
        if (heap.empty() || k <= 0) return result;

        int limit = std::min(k, static_cast<int>(heap.size()));
        result.reserve(limit);

        // Min-heap tracking top candidate indices
        auto comp = [this](int a, int b) {
            return heap[a] < heap[b]; // greater element has higher priority
        };
        std::vector<int> candidates;
        candidates.push_back(0);

        for (int i = 0; i < limit && !candidates.empty(); ++i) {
            std::pop_heap(candidates.begin(), candidates.end(), comp);
            int bestIdx = candidates.back();
            candidates.pop_back();

            result.push_back(heap[bestIdx]);

            int left = 2 * bestIdx + 1;
            int right = 2 * bestIdx + 2;
            int n = static_cast<int>(heap.size());

            if (left < n) {
                candidates.push_back(left);
                std::push_heap(candidates.begin(), candidates.end(), comp);
            }
            if (right < n) {
                candidates.push_back(right);
                std::push_heap(candidates.begin(), candidates.end(), comp);
            }
        }

        return result;
    }

    // Rank query: O(N) linear scan required!
    // Heaps do NOT maintain complete order or subtree sizes.
    int getRank(const std::string& userId) const {
        auto it = indexMap.find(userId);
        if (it == indexMap.end()) return -1;

        const UserRecord& target = heap[it->second];
        int countGreater = 0;
        for (const auto& item : heap) {
            if (item > target) {
                countGreater++;
            }
        }
        return countGreater + 1;
    }
};

// ============================================================================
// 3. Baseline Naive Leaderboard (Hash Map + Dynamic Array)
// ============================================================================
// Used as the baseline reference to demonstrate algorithmic speedups.
// - Update: O(1) in hash map
// - Top-K: O(N log N) full sort or O(N log K) partial sort
// - getRank: O(N) linear scan
// ============================================================================

class NaiveLeaderboard {
private:
    std::unordered_map<std::string, UserRecord> userMap;

public:
    int size() const {
        return static_cast<int>(userMap.size());
    }

    void updateScore(const std::string& userId, long long newScore, long long timestamp) {
        userMap[userId] = UserRecord(userId, newScore, timestamp);
    }

    std::vector<UserRecord> getTopK(int k) const {
        std::vector<UserRecord> allRecords;
        allRecords.reserve(userMap.size());
        for (const auto& kv : userMap) {
            allRecords.push_back(kv.second);
        }

        int limit = std::min(k, static_cast<int>(allRecords.size()));
        std::partial_sort(allRecords.begin(), allRecords.begin() + limit, allRecords.end(),
                          [](const UserRecord& a, const UserRecord& b) {
                              return a > b;
                          });

        allRecords.resize(limit);
        return allRecords;
    }

    int getRank(const std::string& userId) const {
        auto it = userMap.find(userId);
        if (it == userMap.end()) return -1;

        const UserRecord& target = it->second;
        int countGreater = 0;
        for (const auto& kv : userMap) {
            if (kv.second > target) {
                countGreater++;
            }
        }
        return countGreater + 1;
    }
};

// ============================================================================
// Benchmark Runner & Test Suite
// ============================================================================

struct BenchmarkResult {
    std::string name;
    double updateTimeMs;
    double topKTimeMs;
    double rankQueryTimeMs;
    double totalTimeMs;
    double avgLatencyMicros;
};

void runBenchmarkSuite(int numUsers, int numUpdates, int topK, int numQueries) {
    std::cout << "\n============================================================\n";
    std::cout << " RANKFLOW BENCHMARK: HIGH-FREQUENCY LEADERBOARD ENGINE\n";
    std::cout << "============================================================\n";
    std::cout << " Initial Users:       " << numUsers << "\n";
    std::cout << " Repeated Updates:    " << numUpdates << "\n";
    std::cout << " Top-K Requested:     " << topK << "\n";
    std::cout << " Point Rank Queries:  " << numQueries << "\n";
    std::cout << "============================================================\n\n";

    // Pre-generate workload to ensure 100% fair, identical test input for all 3
    std::mt19937 rng(42);
    std::uniform_int_distribution<int> userDist(1, numUsers);
    std::uniform_int_distribution<int> scoreDist(10, 100000);
    std::uniform_int_distribution<int> deltaDist(5, 500);

    struct UpdateOp {
        std::string userId;
        long long newScore;
        long long timestamp;
    };

    std::vector<UpdateOp> updates;
    updates.reserve(numUpdates);
    for (int i = 0; i < numUpdates; ++i) {
        UpdateOp op;
        op.userId = "User_" + std::to_string(userDist(rng));
        op.newScore = scoreDist(rng);
        op.timestamp = i + 1;
        updates.push_back(op);
    }

    std::vector<std::string> sampleQueryUsers;
    sampleQueryUsers.reserve(numQueries);
    for (int i = 0; i < numQueries; ++i) {
        sampleQueryUsers.push_back("User_" + std::to_string(userDist(rng)));
    }

    std::vector<BenchmarkResult> results;

    // ------------------------------------------------------------------------
    // Test 1: Order Statistic AVL Tree
    // ------------------------------------------------------------------------
    std::cout << "[1/3] Benchmarking Order Statistic AVL Tree..." << std::flush;
    {
        OrderStatisticAVLTree avl;
        // Warm up initial population
        for (int i = 1; i <= numUsers; ++i) {
            avl.insert(UserRecord("User_" + std::to_string(i), 100, 0));
        }

        // 1. Repeated updates
        auto start = std::chrono::high_resolution_clock::now();
        for (const auto& op : updates) {
            avl.updateScore(op.userId, op.newScore, op.timestamp);
        }
        auto end = std::chrono::high_resolution_clock::now();
        double updateMs = std::chrono::duration<double, std::milli>(end - start).count();

        // 2. Top-K queries (repeated 100 times to get stable measurement)
        start = std::chrono::high_resolution_clock::now();
        for (int q = 0; q < 100; ++q) {
            auto top = avl.getTopK(topK);
        }
        end = std::chrono::high_resolution_clock::now();
        double topKMs = std::chrono::duration<double, std::milli>(end - start).count() / 100.0;

        // 3. Point Rank queries
        start = std::chrono::high_resolution_clock::now();
        for (const auto& u : sampleQueryUsers) {
            volatile int r = avl.getRank(u);
            (void)r;
        }
        end = std::chrono::high_resolution_clock::now();
        double rankMs = std::chrono::duration<double, std::milli>(end - start).count();

        double totalMs = updateMs + (topKMs * 100.0) + rankMs;
        double avgMicros = (updateMs * 1000.0) / numUpdates;

        results.push_back({"Order Statistic AVL Tree", updateMs, topKMs, rankMs, totalMs, avgMicros});
        std::cout << " Done.\n";
    }

    // ------------------------------------------------------------------------
    // Test 2: Indexed Max-Heap
    // ------------------------------------------------------------------------
    std::cout << "[2/3] Benchmarking Indexed Max-Heap..." << std::flush;
    {
        IndexedMaxHeap heap;
        for (int i = 1; i <= numUsers; ++i) {
            heap.insert(UserRecord("User_" + std::to_string(i), 100, 0));
        }

        // 1. Repeated updates
        auto start = std::chrono::high_resolution_clock::now();
        for (const auto& op : updates) {
            heap.updateScore(op.userId, op.newScore, op.timestamp);
        }
        auto end = std::chrono::high_resolution_clock::now();
        double updateMs = std::chrono::duration<double, std::milli>(end - start).count();

        // 2. Top-K queries
        start = std::chrono::high_resolution_clock::now();
        for (int q = 0; q < 100; ++q) {
            auto top = heap.getTopK(topK);
        }
        end = std::chrono::high_resolution_clock::now();
        double topKMs = std::chrono::duration<double, std::milli>(end - start).count() / 100.0;

        // 3. Point Rank queries (linear scan on heap)
        // If query count is large on large N, limit to first 500 to keep benchmark fast
        int testQueries = std::min(numQueries, 500);
        start = std::chrono::high_resolution_clock::now();
        for (int i = 0; i < testQueries; ++i) {
            volatile int r = heap.getRank(sampleQueryUsers[i]);
            (void)r;
        }
        end = std::chrono::high_resolution_clock::now();
        double rankMs = std::chrono::duration<double, std::milli>(end - start).count();
        if (testQueries < numQueries) {
            rankMs = (rankMs / testQueries) * numQueries; // scale to same query count
        }

        double totalMs = updateMs + (topKMs * 100.0) + rankMs;
        double avgMicros = (updateMs * 1000.0) / numUpdates;

        results.push_back({"Indexed Max-Heap", updateMs, topKMs, rankMs, totalMs, avgMicros});
        std::cout << " Done.\n";
    }

    // ------------------------------------------------------------------------
    // Test 3: Baseline Naive Map + Array
    // ------------------------------------------------------------------------
    std::cout << "[3/3] Benchmarking Baseline Map + Sort..." << std::flush;
    {
        NaiveLeaderboard naive;
        for (int i = 1; i <= numUsers; ++i) {
            naive.updateScore("User_" + std::to_string(i), 100, 0);
        }

        // 1. Repeated updates
        auto start = std::chrono::high_resolution_clock::now();
        for (const auto& op : updates) {
            naive.updateScore(op.userId, op.newScore, op.timestamp);
        }
        auto end = std::chrono::high_resolution_clock::now();
        double updateMs = std::chrono::duration<double, std::milli>(end - start).count();

        // 2. Top-K queries (partial sort of N items)
        start = std::chrono::high_resolution_clock::now();
        for (int q = 0; q < 100; ++q) {
            auto top = naive.getTopK(topK);
        }
        end = std::chrono::high_resolution_clock::now();
        double topKMs = std::chrono::duration<double, std::milli>(end - start).count() / 100.0;

        // 3. Point Rank queries
        int testQueries = std::min(numQueries, 500);
        start = std::chrono::high_resolution_clock::now();
        for (int i = 0; i < testQueries; ++i) {
            volatile int r = naive.getRank(sampleQueryUsers[i]);
            (void)r;
        }
        end = std::chrono::high_resolution_clock::now();
        double rankMs = std::chrono::duration<double, std::milli>(end - start).count();
        if (testQueries < numQueries) {
            rankMs = (rankMs / testQueries) * numQueries;
        }

        double totalMs = updateMs + (topKMs * 100.0) + rankMs;
        double avgMicros = (updateMs * 1000.0) / numUpdates;

        results.push_back({"Naive Map + Sort", updateMs, topKMs, rankMs, totalMs, avgMicros});
        std::cout << " Done.\n";
    }

    // ------------------------------------------------------------------------
    // Print Summary Comparison Table
    // ------------------------------------------------------------------------
    std::cout << "\n" << std::string(78, '=') << "\n";
    std::cout << " STRATEGY & DATA STRUCTURE PERFORMANCE COMPARISON SUMMARY\n";
    std::cout << std::string(78, '=') << "\n";
    std::cout << std::left << std::setw(28) << "Data Structure"
              << std::right << std::setw(12) << "Updates (ms)"
              << std::setw(12) << "Avg/Upd (us)"
              << std::setw(12) << "Top-K (ms)"
              << std::setw(14) << "RankQry (ms)" << "\n";
    std::cout << std::string(78, '-') << "\n";

    for (const auto& r : results) {
        std::cout << std::left << std::setw(28) << r.name
                  << std::right << std::fixed << std::setprecision(2)
                  << std::setw(12) << r.updateTimeMs
                  << std::setw(12) << r.avgLatencyMicros
                  << std::setw(12) << r.topKTimeMs
                  << std::setw(14) << r.rankQueryTimeMs << "\n";
    }
    std::cout << std::string(78, '-') << "\n";

    std::cout << "\nComplexity Summary:\n";
    std::cout << "  - Order Statistic Tree: Update O(log N), Top-K O(K + log N), Rank O(log N)\n";
    std::cout << "  - Indexed Max-Heap:     Update O(log N), Top-K O(K log N),   Rank O(N) [Slow]\n";
    std::cout << "  - Naive Map + Array:    Update O(1),     Top-K O(N log N),   Rank O(N) [Slow]\n";
    std::cout << "\nKey Conclusion:\n";
    std::cout << "  The Order Statistic Tree is the ONLY structure that simultaneously achieves\n";
    std::cout << "  logarithmic bounds O(log N) for BOTH score updates and exact ranking queries,\n";
    std::cout << "  making it the optimal choice for real-time leaderboards.\n";
    std::cout << std::string(78, '=') << "\n";
}

// ----------------------------------------------------------------------------
// Interactive CLI Mode
// ----------------------------------------------------------------------------
void runInteractiveDemo() {
    std::cout << "\n============================================================\n";
    std::cout << " RANKFLOW INTERACTIVE DEMO (ORDER STATISTIC AVL ENGINE)\n";
    std::cout << "============================================================\n";

    OrderStatisticAVLTree engine;

    // Seed 10 sample players
    std::vector<std::pair<std::string, long long>> initialUsers = {
        {"Alice", 9500}, {"Bob", 8800}, {"Charlie", 9200}, {"Diana", 7900},
        {"Evan", 8400}, {"Fiona", 9950}, {"George", 6500}, {"Hannah", 9100},
        {"Ian", 7300}, {"Julia", 8800}
    };

    long long timer = 1;
    for (const auto& u : initialUsers) {
        engine.insert(UserRecord(u.first, u.second, timer++));
    }

    std::cout << "\n[Initial Top 5 Leaderboard]:\n";
    auto top5 = engine.getTopK(5);
    for (size_t i = 0; i < top5.size(); ++i) {
        std::cout << "  #" << (i + 1) << " " << std::left << std::setw(12) << top5[i].userId
                  << " Score: " << top5[i].score << "\n";
    }

    std::cout << "\n[Query Rank]:\n";
    std::cout << "  Alice's Rank:   #" << engine.getRank("Alice") << " (Score: " << engine.getScore("Alice") << ")\n";
    std::cout << "  George's Rank:  #" << engine.getRank("George") << " (Score: " << engine.getScore("George") << ")\n";

    std::cout << "\n[Query by Rank]:\n";
    std::cout << "  User at Rank #1: " << engine.getByRank(1).userId << "\n";
    std::cout << "  User at Rank #3: " << engine.getByRank(3).userId << "\n";

    std::cout << "\n[Simulating Score Update]: George gets +3000 points! (6500 -> 9500)\n";
    engine.updateScore("George", 9500, timer++);

    std::cout << "\n[Updated Top 5 Leaderboard]:\n";
    top5 = engine.getTopK(5);
    for (size_t i = 0; i < top5.size(); ++i) {
        std::cout << "  #" << (i + 1) << " " << std::left << std::setw(12) << top5[i].userId
                  << " Score: " << top5[i].score << "\n";
    }
    std::cout << "  George's New Rank: #" << engine.getRank("George") << "\n";
    std::cout << "============================================================\n";
}

int main(int argc, char* argv[]) {
    // Default benchmark parameters
    int numUsers = 10000;
    int numUpdates = 50000;
    int topK = 10;
    std::string mode = "benchmark";

    if (argc >= 2) numUsers = std::stoi(argv[1]);
    if (argc >= 3) numUpdates = std::stoi(argv[2]);
    if (argc >= 4) topK = std::stoi(argv[3]);
    if (argc >= 5) mode = argv[4];

    if (mode == "interactive" || mode == "demo") {
        runInteractiveDemo();
    } else {
        runInteractiveDemo();
        runBenchmarkSuite(numUsers, numUpdates, topK, 1000);
    }

    return 0;
}
