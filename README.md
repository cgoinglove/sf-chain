# 🔗 SafeChain 🔗

SafeChain is a functional utility library for JavaScript/TypeScript that simplifies error handling and asynchronous operations. It supports both synchronous and asynchronous operations while ensuring strong type safety.

## Features

- **Stable Type Safety**: Provides consistent type safety regardless of whether operations are synchronous or asynchronous
- **Separation of Pure Functions and Side Effects**: Clearly distinguishes between methods with side effects and those without
- **Safe Chaining**: Allows the chain to continue execution even when errors occur
- **Delayed Error Handling**: Does not throw exceptions until `unwrap()` is called, even when errors occur

## Installation

```bash
npm install sf-chain
```

```bash
pnpm add sf-chain
```

```bash
yarn add sf-chain
```

## Basic Usage

```typescript
import { safe } from 'sf-chain'

const result = safe(10)
          .map(...) // Transform the value T -> U
          .effect(...) // Side effect with error propagation
          .tab(...) // Side effect without error propagation

result.isOk(); // Check if chain contains a success value
result.isError(); // Check if chain contains an error
result.unwrap(); // Extract the final value (throws if there was an error)

```

### Starting a Chain

```typescript
import { safe, safeValue } from 'sf-chain'

// Start with a value
const chain1 = safeValue(42)
// safe(42) == safeValue(42)
const chain2 = safe(42)

// Start with a function
// ✅ safe(()=>100)
// ❌ safeValue(()=>100)
const chain3 = safe(() => {
  return 100
})

// Start without parameters (creates a chain with an undefined value)
const chain4 = safe()
```

### map: Transforming Values

```typescript
// Example of transforming values
const result = safe(5)
  .map(x => x * 2) // 5 -> 10
  .map(x => x + 3) // 10 -> 13
  .map(x => `The value is ${x}`) // 13 -> "The value is 13"

console.log(result.isOk()) // true
console.log(result.unwrap()) // "The value is 13"

// If there's an error, map is not executed
const errorChain = safe(1)
  .map(x => new Error('Error occurred'))
  .map(x => x * 2) // This transformation is not executed

console.log(result.isError()) // true

try {
  errorChain.unwrap() // Throws the error
} catch (e) {
  console.error(e.message) // "Error occurred"
}
```

### effect: Applying Side Effects

```typescript
// Synchronous effect example

const syncResult = safe(42)
  .effect(value => {
    console.log(`Processing: ${value}`)
    // Effect only propagates errors or makes chain async with promises, but doesn't transform the value
    return Boolean(value) // This return value doesn't affect the chain's value
  })
  .unwrap() // 42

// Asynchronous effect example
const asyncChain = safe('data').effect(async data => {
  // Returning a Promise makes the chain asynchronous
  await saveToDatabase(data)
})

// Now unwrap() returns a Promise
const result = await asyncChain.unwrap() // "data"

// Asynchronous effect example
const asyncChain = safe('data').effect(async data => {
  await saveToDatabase(data)
  return true
})
asyncChain.unwrap() // Promise<string>
```

### tap: Observing Values

```typescript
// tap observes values and errors without affecting the chain
const result = safe(42)
  .tap(result => {
    if (result.isError) {
      console.error(`Error occurred: ${result.error.message}`)
    } else {
      console.log(`Current value: ${result.value}`)
      // Errors thrown here don't affect the chain
      throw new Error('This error is ignored!')
    }
  })
  .map(x => x * 2) // 42 -> 84

result.isOk() // true
result.unwrap() // 84

// Returning a Promise doesn't affect the chain's synchronicity
const syncChain = safe(10)
  .tap(async result => {
    if (!result.isError) {
      await someAsyncOperation()
      console.log('Async operation completed')
    }
  })
  .map(x => x + 5) // Still operates synchronously

console.log(syncChain.unwrap()) // 15 (synchronous return)
```

### recover: Recovering from Errors

```typescript
// Error recovery example
const chain = safe(() => {
  throw new Error('Initial error')
})
  .map(x => x + 10) // Not executed due to the error
  .recover(error => {
    console.log(`Error recovery: ${error.message}`)
    return 42 // Provide a fallback value
  })
  .map(x => x * 2) // Applied to the recovered value (42)

console.log(chain.unwrap()) // 84

// Asynchronous recovery example
const asyncRecovery = safe(() => {
  throw new Error('Async recovery needed')
}).recover(async error => {
  // Asynchronous recovery makes the chain asynchronous
  const fallbackData = await fetchFallbackData()
  return fallbackData
})

// Now unwrap() returns a Promise
const recoveredData = await asyncRecovery.unwrap()
```

## Practical Examples

### Client-Side Example (React)

```typescript
import { safe } from 'sf-chain';
import { useState, useEffect } from 'react';

function ProductList({ categoryId }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Load product data
    safe(categoryId)
      .tap(() => setLoading(true)) // Start loading
      .map(toRequestParams)
      .effect(fetchProducts) // API call
      .tap(result => {
        setLoading(false); // End loading

        if (result.isError) {
          // Set default value on error
          setProducts([]);
        } else {
          // Set data on success
          setProducts(result.value);
        }
      });
  }, [categoryId]);

  return (
    <div>
      {loading && <LoadingSpinner />}
      {products.length > 0 ? (
        <ProductGrid items={products} />
      ) : (
        <EmptyState />
      )}
    </div>
  );
}
```

### Server-Side Example

```typescript
import { safe } from 'sf-chain'

function saveUserData(userData) {
  return safe(userData)
    .map(normalizeData)
    .effect(validateData)
    .effect(saveToDatabase)
    .tap(result => {
      if (result.isError) {
        logError('Save failed', result.error)
      } else {
        logSuccess('Save succeeded', result.value.id)
      }
    })
    .recover(error => ({
      success: false,
      error: error.message,
    }))
    .unwrap()
}

// Usage
app.post('/api/users', async (req, res) => {
  const result = await saveUserData(req.body)
  res.status(result.success ? 200 : 400).json(result)
})
```

### pipe: Creating Function Pipelines

`safe.pipe` creates a pipeline that processes data sequentially through multiple functions. The result of each function is passed as input to the next function.

```typescript
import { safe, safePipe } from 'sf-chain'

// safe.pipe === safePipe

// Number processing pipeline
const processNumber = safe.pipe(
  num => num * 2, // Double the number
  num => num + 10, // Add 10
  num => `Result: ${num}`, // Convert to string
)

// Usage
const result = processNumber(5)
console.log(result.unwrap()) // "Result: 20"

// Can include asynchronous functions
const fetchAndProcess = safe.pipe(
  id => id.toString(),
  idStr => fetchData(idStr), // Function that returns a Promise
  data => data.value,
)

// If any function is asynchronous, the result is asynchronous
const asyncResult = await fetchAndProcess(42).unwrap()
```

`pipe` is useful in functional programming for clearly expressing data flow. Each step is independent and composed of pure functions, which improves code readability and maintainability.

## Synchronous/Asynchronous Processing and Error Propagation

SafeChain determines synchronous/asynchronous behavior according to these rules:

1. **Methods without side effects** (`tap`)

   - Returning a Promise does not affect the chain's synchronicity
   - Errors that occur inside do not propagate to the chain
   - Access to both values and errors through the Result object

2. **Methods with side effects** (`effect`, `recover`)

   - Returning a Promise makes the chain asynchronous
   - Errors that occur inside propagate to the chain

3. **Value transformation methods** (`map`)
   - Returning a Promise makes the chain asynchronous
   - Errors that occur inside propagate to the chain

## API Reference

### Core Functions

#### `safe<T>(value: T): SafeChain<T>`

#### `safe<T>(fn: () => T): SafeChain<T>`

#### `safe(): SafeChain<undefined>`

Wraps a value or function in a SafeChain. If a function is provided, it executes the function and stores the result in the SafeChain.

### Main Methods

#### `map<U>(transform: (value: Awaited<T>) => U): SafeChain<U | Promise<U>>`

Transforms the value in the chain. Changes the value type from T to U.

#### `tap(consumer: (result: Result<Awaited<T>>) => any): SafeChain<T>`

Observes the current state of the chain without affecting it. Receives a result object containing either a value or an error.

#### `effect<U>(effectFn: (value: Awaited<T>) => U): SafeChain<T | Promise<T>>`

Applies a side effect to the value. If it returns a Promise, the chain becomes asynchronous. If an error occurs, it propagates to the chain.

#### `recover<U>(handler: (error: Error) => U): SafeChain<T | U | Promise<T | U>>`

Provides a fallback value when the chain contains an error. If it returns a Promise, the chain becomes asynchronous.

#### `unwrap(): T | Promise<T>`

Extracts the final value from the chain. Throws an exception if the chain contains an error.

### Utility Functions

#### `safe.pipe(...transformers)`

Creates a pipeline by combining multiple transformation functions. If any function returns a Promise, the entire pipeline becomes asynchronous.

## License

MIT
