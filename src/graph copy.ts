import { SafeChain } from "./core";

type NodeId = string;

/**
 * Base interface for a node in the graph
 */
type SafeNode<
  Id extends NodeId = NodeId,
  Input = any,
  Output = any,
  MetaData = Record<string, any>,
> = {
  /** Unique identifier for the node */
  readonly id: Id;

  /** Input type of the node (for type inference) */
  readonly _input: Input;

  /** Output type of the node (for type inference) */
  readonly _output: Output;

  /** Function to process data in this node */
  readonly processor: (input: Awaited<Input>) => Output;

  /** Metadata about the node (optional) */
  readonly metadata: MetaData;
};

/**
 * 그래프 시작 이벤트
 */
type GraphStartEvent<NodeType extends SafeNode = SafeNode> = {
  /** 이벤트 타입 */
  action: "GRAPH_START";
  /** 이벤트 발생 시간 */
  timestamp: number;
  /** 실행 ID */
  executionId: string;
  /** 시작 노드 ID */
  startNodeId: NodeType["id"];
  /** 시작 노드 입력 */
  input: NodeType["_input"];
};

/**
 * 그래프 종료 이벤트
 */
type GraphEndEvent<NodeType extends SafeNode = SafeNode> = {
  /** 이벤트 타입 */
  action: "GRAPH_END";
  /** 이벤트 발생 시간 */
  timestamp: number;
  /** 실행 ID */
  executionId: string;
  /** 시작 노드 ID */
  endNodeId: NodeType["id"];
  /** 최종 결과 */
  output: NodeType["_output"];
  /** 총 실행 시간 (ms) */
  executionTimeMs: number;
  /** 실행 경로 */
  path: NodeId[];
  /** 성공 여부 */
  success: boolean;
  /** 오류 (있는 경우) */
  error?: Error;
};

/**
 * 노드 시작 이벤트
 */
type NodeStartEvent<NodeType extends SafeNode = SafeNode> = {
  /** 이벤트 타입 */
  action: "NODE_START";
  /** 이벤트 발생 시간 */
  timestamp: number;
  /** 실행 ID */
  executionId: string;
  /** 노드 ID */
  nodeId: NodeType["id"];
  /** 노드 메타데이터 */
  metadata: NodeType["metadata"];
  /** 노드 입력 */
  input: NodeType["_input"];
};

/**
 * 노드 종료 이벤트
 */
type NodeEndEvent<NodeType extends SafeNode = SafeNode> = {
  /** 이벤트 타입 */
  action: "NODE_END";
  /** 이벤트 발생 시간 */
  timestamp: number;
  /** 실행 ID */
  executionId: string;
  /** 노드 ID */
  nodeId: NodeType["id"];
  /** 노드 메타데이터 */
  metadata: NodeType["metadata"];
  /** 노드 입력 */
  input: NodeType["_input"];
  /** 노드 출력 */
  output: NodeType["_output"];
  /** 실행 시간 (ms) */
  executionTimeMs: number;
  /** 성공 여부 */
  success: boolean;
  /** 오류 (있는 경우) */
  error?: Error;
};

/**
 * 그래프 이벤트의 유니온 타입
 */
type GraphEventUnion<NodeType extends SafeNode = SafeNode> =
  | GraphStartEvent<NodeType>
  | GraphEndEvent<NodeType>
  | NodeStartEvent<NodeType>
  | NodeEndEvent<NodeType>;

/**
 * Helper type to extract node properties by ID
 */
type ExtractNode<Nodes extends SafeNode, Id extends NodeId> = Extract<
  Nodes,
  { id: Id }
>;

/**
 * Helper type to get input type of a node by ID
 */
type InputOf<Nodes extends SafeNode, Id extends NodeId> = ExtractNode<
  Nodes,
  Id
>["_input"];

/**
 * Helper type to get output type of a node by ID
 */
type OutputOf<Nodes extends SafeNode, Id extends NodeId> = ExtractNode<
  Nodes,
  Id
>["_output"];

type MetaDataOf<Nodes extends SafeNode, Id extends NodeId> = ExtractNode<
  Nodes,
  Id
>["metadata"];

/**
 * Helper type to get the first node from an array of nodes
 */
type FirstNode<Nodes extends readonly SafeNode[]> = Nodes extends readonly [
  infer First,
  ...any[],
]
  ? First extends SafeNode
    ? First
    : never
  : never;

/**
 * Helper type to check if any of the nodes' outputs are promises
 */
type HasPromise<Nodes extends readonly SafeNode[]> = {
  [K in keyof Nodes]: Nodes[K]["_output"] extends Promise<any> ? true : false;
}[number] extends false
  ? false
  : true;

/**
 * Helper type to verify type compatibility between nodes
 */
type ValidConnection<
  Nodes extends readonly SafeNode[],
  FromId extends Nodes[number]["id"],
  ToId extends Nodes[number]["id"],
> =
  Awaited<OutputOf<Nodes[number], FromId>> extends InputOf<Nodes[number], ToId>
    ? ToId
    : never;

/**
 * Helper type to get all valid target nodes for a given source node
 */
type ValidTargets<
  Nodes extends readonly SafeNode[],
  FromId extends Nodes[number]["id"],
> = {
  [K in Nodes[number]["id"]]: ValidConnection<Nodes, FromId, K>;
}[Nodes[number]["id"]];

/**
 * Represents a graph of nodes
 */
export type SafeGraph<
  Nodes extends readonly SafeNode[],
  IsPromise extends boolean = false,
> = {
  subscribe<N extends Nodes[number]>(
    listener: (event: GraphEventUnion<N>) => void,
  ): () => void;
  /**
   * Connect nodes directly
   * Ensures that the output of the source node is compatible with the input of the target node
   *
   * @param from Source node ID
   * @param to Target node ID (must be compatible with source node's output)
   * @returns The updated graph for chaining
   */
  connect<
    FromId extends Nodes[number]["id"],
    ToId extends ValidTargets<Nodes, FromId>,
  >(
    from: FromId,
    to: ToId,
  ): SafeGraph<Nodes, IsPromise>;

  /**
   * Connect nodes with dynamic routing
   * Ensures that the router function returns a node ID that's compatible with the source node's output
   *
   * @param from Source node ID
   * @param router Function that determines the next node based on the result
   * @returns The updated graph for chaining
   */
  connect<FromId extends Nodes[number]["id"]>(
    from: FromId,
    router: (context: {
      input: Awaited<InputOf<Nodes[number], FromId>>;
      output: Awaited<OutputOf<Nodes[number], FromId>>;
      metadata: MetaDataOf<Nodes[number], FromId>;
    }) => ValidTargets<Nodes, FromId> | null,
  ): SafeGraph<Nodes, IsPromise>;

  /**
   * Connect nodes with dynamic async routing
   *
   * @param from Source node ID
   * @param router Function that returns a Promise of a node ID
   * @returns The updated graph for chaining
   */
  connect<FromId extends Nodes[number]["id"]>(
    from: FromId,
    router: (context: {
      input: Awaited<InputOf<Nodes[number], FromId>>;
      output: Awaited<OutputOf<Nodes[number], FromId>>;
      metadata: MetaDataOf<Nodes[number], FromId>;
    }) => Promise<ValidTargets<Nodes, FromId> | null>,
  ): SafeGraph<Nodes, true>;

  /**
   * Execute the graph starting from the specified node
   *
   * @param startNodeId ID of the node to start execution from
   * @param input Input data for the starting node
   * @returns A SafeChain containing the result of the last executed node
   */
  execute<StartId extends Nodes[number]["id"]>(
    startNodeId: StartId,
    input: InputOf<Nodes[number], StartId>,
  ): SafeChain<
    IsPromise extends true
      ? Promise<Awaited<OutputOf<Nodes[number], Nodes[number]["id"]>>>
      : Awaited<OutputOf<Nodes[number], Nodes[number]["id"]>>
  >;

  /**
   * Execute the graph starting from the first node
   *
   * @param input Input data for the first node
   * @returns A SafeChain containing the result of the last executed node
   */
  execute(
    input: InputOf<FirstNode<Nodes>, FirstNode<Nodes>["id"]>,
  ): SafeChain<
    IsPromise extends true
      ? Promise<Awaited<OutputOf<Nodes[number], Nodes[number]["id"]>>>
      : Awaited<OutputOf<Nodes[number], Nodes[number]["id"]>>
  >;
};

/**
 * Creates a node for use in a graph
 *
 * @param id Unique identifier for the node
 * @param processor Function to process data in this node
 * @param metadata Optional metadata for the node
 * @returns A SafeNode instance
 */
export function createNode<
  Id extends NodeId,
  Input,
  Output,
  MetaData = Record<string, string>,
>(node: {
  id: Id;
  processor: (input: Awaited<Input>) => Output;
  metadata?: MetaData;
}): SafeNode<Id, Input, Output, MetaData> {
  return {
    ...node,
    metadata: node.metadata ?? {},
    _input: null as unknown as Input, // Type marker only, not used at runtime
    _output: null as unknown as Output, // Type marker only, not used at runtime
  } as SafeNode<Id, Input, Output, MetaData>;
}

/**
 * Creates a new graph with the specified nodes
 *
 * @param nodes Array of nodes to add to the graph
 * @returns A new SafeGraph instance
 */
export function safeGraph<Nodes extends readonly SafeNode[]>(
  ...nodes: [...Nodes]
): SafeGraph<Nodes, HasPromise<Nodes>> {
  nodes.concat();
  return {} as SafeGraph<Nodes, HasPromise<Nodes>>;
}

// Example Usage:
const aNode = createNode({
  id: "a",
  processor: (input: string) => ({ value: Number(input) }),
});
const bNode = createNode({
  id: "b",
  processor: (input: { value: number }) => input.value.toString(),
  metadata: {
    ok: "",
  },
});
const cNode = createNode({
  id: "c",
  processor: (input: string) => input.length,
});
const dNode = createNode({
  id: "d",
  processor: (input: number) => input * 2,
});

const graph = safeGraph(aNode, bNode, cNode, dNode)
  .connect("a", "b")
  .connect("b", "c")
  .connect("c", "d")
  .connect("b", (context) => {
    if (context.output.length > 3) {
      return "c";
    }
    return null;
  });

// Execute with explicit start node
const result1 = graph.execute("a", "42");
result1.unwrap();
// Execute with default start node (aNode)
const result2 = graph.execute("42");
result2.unwrap();
