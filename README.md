# mercado-libre-clone
An application replicating Mercado Libre Page. But using the best practices and programming concepts

---

## Directory Backend structure

This is a high-level overview of the backend directory structure, following the principles of Clean Architecture and Domain-Driven Design (DDD). Each layer has its own responsibilities, promoting separation of concerns and maintainability. (Hexagonal Architecture)

```
packages/backend/
├── src/
│   ├── application/           # Use cases and application rules 
│   │   ├── usecases/
│   │   │   └── product/
│   │   │       ├── get-product-details.usecase.ts
│   │   │       └── list-products.usecase.ts
│   │   ├── dtos/             # Data Transfer Objects
│   │   └── ports/            # Interfaces/Contracts
│   │       ├── repositories/
│   │       └── services/
│   ├── domain/               # Entities and business rules
│   │   ├── entities/
│   │   │   ├── product.entity.ts
│   │   │   ├── seller.entity.ts
│   │   │   └── payment-method.entity.ts
│   │   ├── value-objects/
│   │   └── errors/
│   ├── infrastructure/       # Concrete implementations
│   │   ├── repositories/
│   │   │   └── json-product.repository.ts
│   │   ├── database/
│   │   │   └── products.json
│   │   └── config/
│   ├── presentation/         # Controllers and middlewares
│   │   ├── controllers/
│   │   │   └── product.controller.ts
│   │   ├── middlewares/
│   │   │   ├── error-handler.middleware.ts
│   │   │   ├── validation.middleware.ts
│   │   │   └── cors.middleware.ts
│   │   ├── routes/
│   │   │   └── product.routes.ts
│   │   └── schemas/
│   ├── shared/               # Shared utilities
│   │   ├── utils/
│   │   ├── constants/
│   │   └── types/
│   └── main.ts              # Entry point of the application
├── tests/                   # Unit and integration tests
│   ├── unit/
│   ├── integration/
│   └── fixtures/
├── docs/                    # API documentation
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── eslint.config.js
```

## 🏗️ Architectural Rationale & Layer Responsibility Analysis

### Presentation Layer Positioning Justification:

The Express application foundation represents the **Infrastructure Concern Orchestration Layer** within the Presentation tier of our Clean Architecture implementation. This strategic positioning adheres to the **Separation of Concerns Principle** and maintains **Dependency Inversion** by serving as the **Composition Root** for the entire application dependency graph.

### Layer Responsibility Matrix:


Architectural Layer    | Responsibility Scope                | File Location Strategy
-----------------------|-------------------------------------|-------------------------
Domain                 | Business Logic & Entities           | src/domain/
Application           | Use Cases & Business Orchestration  | src/application/
Infrastructure        | Data Access & External Services     | src/infrastructure/
Presentation          | HTTP Interface & Server Management  | src/presentation/

## 🏛️ Architectural Integration Points & Dependency Flow Analysis

### Inbound Dependencies (Infrastructure → Application → Presentation):

```ts
// Dependency Flow Visualization
Domain Layer
    ↓ (Entities, Value Objects, Business Rules)
Application Layer  
    ↓ (Use Cases, DTOs, Repository Ports)
Infrastructure Layer
    ↓ (Repository Implementations, External Services)
Presentation Layer (app.ts)
    ↓ (HTTP Interface, Request/Response Handling)
External Clients (Frontend, API Consumers)
``` 

