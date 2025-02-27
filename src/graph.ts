// import { SafeChain, safeExec, safeValue } from './core'
// import { safePipe, map, tap, effect, recover } from './pipe'

// type NodeId = string

// type SafeNode<Id extends NodeId = NodeId, Input = any, Output = any, MetaData = Record<string, any>> = {
//   readonly id: Id
//   readonly processor: (input: Awaited<Input>) => Output
//   readonly input: Input
//   readonly output: Output
//   metadata: MetaData
// }

// type SafeHistory<Node extends SafeNode> = {
//   startedAt: number
//   endedAt: number
// } & Pick<Node, 'id' | 'input' | 'metadata'> &
//   (
//     | {
//         success: false
//         error: Error
//       }
//     | ({
//         success: true
//       } & Pick<Node, 'output'>)
//   )

// type GraphStartEvent = {
//   action: 'GRAPH_START'
//   timestamp: number
//   executionId: string
// }

// type GraphEndEvent<Node extends SafeNode = SafeNode> = {
//   action: 'GRAPH_END'
//   timestamp: number
//   executionId: string
//   executionTimeMs: number
//   histories: SafeHistory<Node>[]
//   success: boolean
//   error?: Error
// }

// type NodeStartEvent<Node extends SafeNode = SafeNode> = {
//   action: 'NODE_START'
//   timestamp: number
//   executionId: string
// } & Pick<Node, 'id' | 'input' | 'metadata'>

// type NodeEndEvent<Node extends SafeNode = SafeNode> = {
//   action: 'NODE_END'
//   timestamp: number
//   executionId: string
//   executionTimeMs: number
// } & Pick<Node, 'id' | 'input' | 'metadata'> &
//   (
//     | {
//         success: false
//         error: Error
//       }
//     | ({
//         success: true
//       } & Pick<Node, 'output'>)
//   )

// type GraphEventUnion<Node extends SafeNode = SafeNode> =
//   | GraphStartEvent
//   | GraphEndEvent<Node>
//   | NodeStartEvent<Node>
//   | NodeEndEvent<Node>

// /**
//  * Helper type to extract node properties by ID
//  */
// type ExtractNode<Nodes extends SafeNode, Id extends NodeId> = Extract<Nodes, { id: Id }>

// /**
//  * Helper type to get input type of a node by ID
//  */
// type InputOf<Nodes extends SafeNode, Id extends NodeId> = ExtractNode<Nodes, Id>['input']

// /**
//  * Helper type to get output type of a node by ID
//  */
// type OutputOf<Nodes extends SafeNode, Id extends NodeId> = ExtractNode<Nodes, Id>['output']
// /**
//  * Helper type to get metadata type of a node by ID
//  */
// type MetaDataOf<Nodes extends SafeNode, Id extends NodeId> = ExtractNode<Nodes, Id>['metadata']

// /**
//  * Helper type to check if any of the nodes' outputs are promises
//  */
// type HasPromise<Nodes extends readonly SafeNode[]> = {
//   [K in keyof Nodes]: Nodes[K]['output'] extends Promise<any> ? true : false
// }[number] extends false
//   ? false
//   : true

// /**
//  * Helper type to verify type compatibility between nodes
//  */
// type ValidConnection<
//   Nodes extends readonly SafeNode[],
//   FromId extends Nodes[number]['id'],
//   ToId extends Nodes[number]['id'],
// > = Awaited<OutputOf<Nodes[number], FromId>> extends InputOf<Nodes[number], ToId> ? ToId : never

// /**
//  * Helper type to get all valid target nodes for a given source node
//  */
// type ValidTargets<Nodes extends readonly SafeNode[], FromId extends Nodes[number]['id']> = {
//   [K in Nodes[number]['id']]: ValidConnection<Nodes, FromId, K>
// }[Nodes[number]['id']]

// type ElementType<T> = T extends (infer U)[] ? U : never

// export type SafeGraph<Nodes extends readonly SafeNode[], IsPromise extends boolean = false> = {
//   subscribe(listener: (event: GraphEventUnion<ElementType<Nodes>>) => void): SafeGraph<Nodes, IsPromise>
//   unSubscribe(listener: (event: GraphEventUnion<ElementType<Nodes>>) => void): SafeGraph<Nodes, IsPromise>
//   addEdge<FromId extends Nodes[number]['id'], ToId extends ValidTargets<Nodes, FromId>>(
//     from: FromId,
//     to: ToId,
//   ): SafeGraph<Nodes, IsPromise>

//   addEdge<FromId extends Nodes[number]['id'], ToId extends ValidTargets<Nodes, FromId> | null>(
//     from: FromId,
//     router: (context: {
//       input: InputOf<Nodes[number], FromId>
//       output: Awaited<OutputOf<Nodes[number], FromId>>
//       metadata: MetaDataOf<Nodes[number], FromId>
//     }) => ToId,
//   ): SafeGraph<Nodes, IsPromise>

//   addEdge<FromId extends Nodes[number]['id'], ToId extends ValidTargets<Nodes, FromId> | null>(
//     from: FromId,
//     router: (context: {
//       input: InputOf<Nodes[number], FromId>
//       output: Awaited<OutputOf<Nodes[number], FromId>>
//       metadata: MetaDataOf<Nodes[number], FromId>
//     }) => Promise<ToId>,
//   ): SafeGraph<Nodes, true>

//   compile<StartId extends Nodes[number]['id'], EndId extends Nodes[number]['id']>(
//     start: StartId,
//     end: EndId,
//   ): (
//     input: InputOf<Nodes[number], StartId>,
//   ) => SafeChain<
//     IsPromise extends true ? Promise<Awaited<OutputOf<Nodes[number], EndId>>> : Awaited<OutputOf<Nodes[number], EndId>>
//   >
//   compile<StartId extends Nodes[number]['id']>(
//     start: StartId,
//   ): (
//     input: InputOf<Nodes[number], StartId>,
//   ) => SafeChain<
//     IsPromise extends true
//       ? Promise<Awaited<OutputOf<Nodes[number], Nodes[number]['id']>>>
//       : Awaited<OutputOf<Nodes[number], Nodes[number]['id']>>
//   >
// }

// export function safeNode<Id extends NodeId, Input = void, Output = void, MetaData = Record<string, string>>(node: {
//   id: Id
//   processor: (input: Input) => Output
//   metadata?: MetaData
// }): SafeNode<Id, Input, Output, MetaData> {
//   return {
//     ...node,
//     metadata: node.metadata ?? ({} as MetaData),
//     input: null as unknown as Input, // Type marker only, not used at runtime
//     output: null as unknown as Output, // Type marker only, not used at runtime
//   } as SafeNode<Id, Input, Output, MetaData>
// }

// // 노드 실행 컨텍스트 정의
// type NodeExecutionContext<Node extends SafeNode = SafeNode> = {
//   nodeId: string
//   input: any
//   output: any
//   node?: Node
//   startTime: number
//   endTime?: number
//   error?: Error
//   success?: boolean
//   executionId: string
//   path: string[]
// }

// class SafeGraphImpl<Nodes extends readonly SafeNode[], IsPromise extends boolean = false>
//   implements SafeGraph<Nodes, IsPromise>
// {
//   private listeners: ((event: GraphEventUnion<ElementType<Nodes>>) => void)[] = []
//   private routes: Map<NodeId, (context: { input: any; output: any; metadata: any }) => any> = new Map()
//   private nodeMap: Map<NodeId, ElementType<Nodes>> = new Map()

//   constructor(nodes: Nodes) {
//     nodes.forEach(node => {
//       if (this.nodeMap.has(node.id)) throw new Error(`Duplicate node ID: ${node.id}`)
//       this.nodeMap.set(node.id, node as ElementType<Nodes>)
//     })
//   }

//   subscribe(listener: (event: GraphEventUnion<ElementType<Nodes>>) => void): SafeGraph<Nodes, IsPromise> {
//     this.listeners.push(listener)
//     return this as SafeGraph<Nodes, IsPromise>
//   }

//   unSubscribe(listener: (event: GraphEventUnion<ElementType<Nodes>>) => void): SafeGraph<Nodes, IsPromise> {
//     const index = this.listeners.indexOf(listener)
//     if (index !== -1) {
//       this.listeners.splice(index, 1)
//     }
//     return this as SafeGraph<Nodes, IsPromise>
//   }

//   private emit(event: GraphEventUnion<ElementType<Nodes>>): void {
//     for (const listener of this.listeners) {
//       listener(event)
//     }
//   }

//   addEdge<FromId extends Nodes[number]['id'], ToId extends ValidTargets<Nodes, FromId>>(
//     from: FromId,
//     to: ToId,
//   ): SafeGraph<Nodes, IsPromise>
//   addEdge<FromId extends Nodes[number]['id'], ToId extends ValidTargets<Nodes, FromId> | null>(
//     from: FromId,
//     to: (context: {
//       input: InputOf<Nodes[number], FromId>
//       output: Awaited<OutputOf<Nodes[number], FromId>>
//       metadata: MetaDataOf<Nodes[number], FromId>
//     }) => ToId,
//   ): SafeGraph<Nodes, IsPromise>
//   addEdge<FromId extends Nodes[number]['id'], ToId extends ValidTargets<Nodes, FromId> | null>(
//     from: FromId,
//     to: (context: {
//       input: InputOf<Nodes[number], FromId>
//       output: Awaited<OutputOf<Nodes[number], FromId>>
//       metadata: MetaDataOf<Nodes[number], FromId>
//     }) => Promise<ToId>,
//   ): SafeGraph<Nodes, true>
//   addEdge(from: unknown, to: unknown): SafeGraph<Nodes, IsPromise> | SafeGraph<Nodes, true> {
//     if (!this.nodeMap.has(from as string)) {
//       throw new Error(`Source node "${from}" not found`)
//     }
//     if (typeof to === 'string') {
//       if (!this.nodeMap.has(to)) throw new Error(`Target node "${to}" not found`)
//       this.routes.set(from as string, () => to)
//     } else this.routes.set(from as string, to as any)

//     this.routes.set(from as string, to as any)
//     return this as SafeGraph<Nodes, IsPromise>
//   }

//   compile<StartId extends Nodes[number]['id'], EndId extends Nodes[number]['id']>(
//     start: StartId,
//     end?: EndId,
//   ): (input: any) => SafeChain<any> {
//     if (!this.nodeMap.has(start as string)) {
//       throw new Error(`Start node "${start}" not found`)
//     }

//     if (end && !this.nodeMap.has(end as string)) {
//       throw new Error(`End node "${end}" not found`)
//     }

//     // 노드 맵과 라우트 맵을 클로저에 캡처
//     const routes = new Map(this.routes)
//     const nodeMap = new Map(this.nodeMap)
//     const emitEvent = this.emit.bind(this)

//     return (input: any): SafeChain<any> => {
//       // 실행 ID 생성
//       const executionId = `exec-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
//       const startTime = Date.now()
//       const histories: SafeHistory<ElementType<Nodes>>[] = []

//       // 그래프 시작 이벤트 발행
//       emitEvent({
//         action: 'GRAPH_START',
//         timestamp: startTime,
//         executionId,
//       })

//       // 초기 실행 컨텍스트 생성
//       const initialContext: NodeExecutionContext = {
//         nodeId: start as string,
//         input,
//         output: null,
//         startTime,
//         executionId,
//         path: [],
//       }

//       // 단일 노드 실행 함수
//       const executeNode = (context: NodeExecutionContext): SafeChain<NodeExecutionContext> => {
//         // 노드 가져오기
//         return safeExec<NodeExecutionContext>(() => {
//           const node = nodeMap.get(context.nodeId)
//           if (!node) throw new Error(`Node "${context.nodeId}" not found`)

//           const nodeStartTime = Date.now()

//           // 노드 시작 이벤트 발행
//           emitEvent({
//             action: 'NODE_START',
//             timestamp: nodeStartTime,
//             executionId,
//             id: context.nodeId,
//             input: context.input,
//             metadata: node.metadata,
//           } as NodeStartEvent<ElementType<Nodes>>)

//           return {
//             ...context,
//             node: node as any,
//             startTime: nodeStartTime,
//             path: [...context.path, context.nodeId],
//           }
//         })
//           .flatMap(ctx => {
//             // 노드 프로세서 실행
//             return safeExec(() => ctx.node!.processor(ctx.input))
//               .map(output => ({
//                 ...ctx,
//                 output,
//                 endTime: Date.now(),
//                 success: true,
//               }))
//               .recover(error => ({
//                 ...ctx,
//                 error,
//                 endTime: Date.now(),
//                 success: false,
//               }))
//           })
//           .tap(ctx => {
//             // 노드 종료 이벤트 발행
//             const executionTimeMs = (ctx.endTime || Date.now()) - ctx.startTime

//             // 히스토리 추가
//             const historyEntry: SafeHistory<ElementType<Nodes>> = {
//               id: ctx.nodeId,
//               startedAt: ctx.startTime,
//               endedAt: ctx.endTime || Date.now(),
//               input: ctx.input,
//               metadata: ctx.node!.metadata,
//             } as any

//             if (ctx.success) {
//               Object.assign(historyEntry, {
//                 success: true,
//                 output: ctx.output,
//               })

//               emitEvent({
//                 action: 'NODE_END',
//                 timestamp: ctx.endTime!,
//                 executionId,
//                 executionTimeMs,
//                 id: ctx.nodeId,
//                 input: ctx.input,
//                 metadata: ctx.node!.metadata,
//                 success: true,
//                 output: ctx.output,
//               } as NodeEndEvent<ElementType<Nodes>>)
//             } else {
//               Object.assign(historyEntry, {
//                 success: false,
//                 error: ctx.error,
//               })

//               emitEvent({
//                 action: 'NODE_END',
//                 timestamp: ctx.endTime!,
//                 executionId,
//                 executionTimeMs,
//                 id: ctx.nodeId,
//                 input: ctx.input,
//                 metadata: ctx.node!.metadata,
//                 success: false,
//                 error: ctx.error,
//               } as NodeEndEvent<ElementType<Nodes>>)
//             }

//             histories.push(historyEntry as SafeHistory<ElementType<Nodes>>)
//           })
//       }

//       // 다음 노드 결정 함수
//       const determineNextNode = (context: NodeExecutionContext): SafeChain<NodeExecutionContext> => {
//         // 종료 조건 검사
//         if (!context.success) {
//           return safeValue(context) // 에러 시 현재 컨텍스트 반환
//         }

//         if (end && context.nodeId === end) {
//           return safeValue(context) // 지정된 종료 노드에 도달하면 현재 컨텍스트 반환
//         }

//         if (!routes.has(context.nodeId)) {
//           return safeValue(context) // 다음 노드가 없으면 현재 컨텍스트 반환
//         }

//         const router = routes.get(context.nodeId)!

//         if (typeof router === 'string') {
//           // 직접 연결된 노드
//           return safeValue({
//             ...context,
//             nodeId: router,
//             input: context.output,
//           })
//         } else {
//           // 라우터 함수 실행
//           return safeExec(() =>
//             router({
//               input: context.input,
//               output: context.output,
//               metadata: context.node!.metadata,
//             }),
//           ).map(nextNodeId => {
//             if (!nextNodeId) return { ...context, nodeId: '' } // 빈 노드 ID는 처리 종료를 의미

//             return {
//               ...context,
//               nodeId: nextNodeId,
//               input: context.output,
//             }
//           })
//         }
//       }

//       // 그래프 실행 함수
//       const executeGraph = (context: NodeExecutionContext): SafeChain<any> => {
//         return executeNode(context)
//           .flatMap(ctx => determineNextNode(ctx))
//           .flatMap(ctx => {
//             if (!ctx.success || !ctx.nodeId) {
//               // 에러 발생 또는 처리 종료
//               return safeValue(ctx.output)
//             }

//             // 다음 노드 실행
//             return executeGraph({
//               ...ctx,
//               startTime: Date.now(),
//             })
//           })
//       }

//       // 그래프 실행 및 완료 이벤트 처리
//       return executeGraph(initialContext).tap(result => {
//         const endTime = Date.now()
//         emitEvent({
//           action: 'GRAPH_END',
//           timestamp: endTime,
//           executionId,
//           executionTimeMs: endTime - startTime,
//           histories,
//           error: result.error,
//           success: !result.isError,
//         } as GraphEndEvent<ElementType<Nodes>>)
//       })
//     }
//   }
// }

// export function safeGraph<Nodes extends readonly SafeNode[]>(
//   ...nodes: [...Nodes]
// ): SafeGraph<Nodes, HasPromise<Nodes>> {
//   return new SafeGraphImpl<Nodes, HasPromise<Nodes>>(nodes)
// }
