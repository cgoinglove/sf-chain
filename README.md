# SafeChain ⛓️

A safe chain utility library that supports both synchronous and asynchronous operations while ensuring **type safety**.

- **Support for Synchronous and Asynchronous Operations**: Handle both sync and async tasks using a single API.
- **Type Safety**: Maintains type safety at every chain step to prevent compile-time errors.
- **Flexible Chain API**: Easily construct workflows with methods like `.map()`, `.ifOk()`, `.ifError()`, etc.
- **Error Handling**: Cleanly handles errors within the chain without the need for separate try-catch blocks.

### EXAMPLE

```typescript
// React side
import { safe } from "sf-chain";

const [state,setState] = useState();

async function fetchData():Data{
    ...
}
function toEntity(data:Data):Entity {
  ...
}

useEffect(()=>{
  safe(fetchData()) // or safe(fechData)
    .map(toEntity)
    .ifOk(setState)
    .ifError((e)=>{ toast.error(e.message); setState(undefined) })
},[])

```

```typescript
// Node side
import { safe } from 'sf-chain';

function saveData(data) {
  return safe(data)
    .ifOk(valid)
    .ifOk(repository.save)
    .map(toEvent)
    .ifOk(producer.produce)
    .ifError(log.error)
    .unwrap();
}
```

```typescript
// Type safety
const chain = safe(10);
chain.isOk(); // boolean
chain.unwrap(); // number

const asyncChain = safe(10).map(num => Promise.resolve(num));
chain.isOk(); // Promise<boolean>
chain.unwrap(); // Promise<number>
```

### API

#### safe(init?: T | (() => T)): SafeChain<T>

- **Description**: Creates a SafeChain instance by accepting either an initial value or a function that returns an initial value.

#### Methods

**map<U>(transform: (value: Awaited<T>) => U): SafeChain<U>**

- Applies the transformation function to the chain’s value if it is in a successful state, returning a new SafeChain with the transformed value.

**ifOk(consumer: (value: Awaited<T>) => any): SafeChain<T>**

- Executes the consumer function if the chain is successful.
- If an error is thrown within the consumer, the chain's state changes to error.
- If no error occurs, the original value remains unchanged.

**ifError(consumer: (error: Error) => any): SafeChain<T>**

- Executes the consumer function to handle errors if the chain is in an error state.

**isOk(): boolean | Promise<boolean>**

- Returns a boolean indicating whether the chain is in a successful state.
- If asynchronous operations are involved, it returns a Promise<boolean>.

**isError(): boolean | Promise<boolean>**

- Returns a boolean indicating whether the chain is in an error state.
- If asynchronous operations are involved, it returns a Promise<boolean>.

**unwrap(): T | Promise<T>**

- Returns the final value of the chain.
- If the chain is in an error state, it throws the corresponding error.
- For asynchronous chains, it returns a Promise<T>.

**flatMap<U>(transform: (value: Awaited<T>) => U): SafeChain<U>**

- 🚧 (Under construction)

### Install

```bash
pnpm add sf-chain
or
npm install sf-chain
or
yarn add sf-chain
```
