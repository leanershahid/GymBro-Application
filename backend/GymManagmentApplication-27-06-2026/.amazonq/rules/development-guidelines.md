# .NET Web API Project Structure Standards
# Enterprise Architecture & Development Guidelines

## 1. Purpose
Ensure maintainability, scalability, separation of concerns, testability, consistent coding standards, and ease of onboarding.

## 2. Solution Architecture (Layered)
```
Solution
├── API
├── Application
├── Domain
├── Infrastructure
└── Tests
```

## 3. Layer Responsibilities

### 3.1 API Layer
- HTTP Endpoints, Authentication & Authorization, Request Validation, Middleware, Swagger, DI Configuration
```
API
├── Controllers
├── Middleware
├── Filters
├── Extensions
├── Configurations
├── Program.cs
└── appsettings.json
```
Controllers must be thin — no business logic.

### 3.2 Application Layer
- Business logic, DTOs, service interfaces, validation, mappings
```
Application
├── Interfaces
├── Services
├── DTOs
├── Validators
└── Mappings
```

### 3.3 Domain Layer
- Entities, enums, constants, domain rules
```csharp
public class Employee
{
    public int EmployeeId { get; set; }
    public string EmployeeCode { get; set; }
    public string FirstName { get; set; }
    public string LastName { get; set; }
}
```

### 3.4 Infrastructure Layer
- Database access, repositories, external integrations, identity, email
```
Infrastructure
├── Data
├── Repositories
├── Identity
└── ExternalServices
```

### 3.5 Test Layer
```
Tests
├── UnitTests
└── IntegrationTests
```

## 4. DTO Standards
Separate Request and Response DTOs.

```csharp
public class CreateEmployeeRequest
{
    public string EmployeeCode { get; set; }
    public string FirstName { get; set; }
    public string LastName { get; set; }
    public string Email { get; set; }
}

public class EmployeeResponse
{
    public int EmployeeId { get; set; }
    public string EmployeeCode { get; set; }
    public string EmployeeName { get; set; }
}
```

## 5. Common Response Models
```csharp
public class ApiResponse<T>
{
    public bool Success { get; set; }
    public string Message { get; set; }
    public T? Data { get; set; }
    public List<string>? Errors { get; set; }
}
```

## 6. Pagination Standard
```csharp
public class PagedResponse<T>
{
    public IEnumerable<T> Items { get; set; }
    public int PageNumber { get; set; }
    public int PageSize { get; set; }
    public int TotalRecords { get; set; }
    public int TotalPages { get; set; }
}
```

## 7. Service Layer Standard
```csharp
public interface IEmployeeService
{
    Task<EmployeeResponse> CreateAsync(CreateEmployeeRequest request);
    Task<EmployeeResponse?> GetByIdAsync(int employeeId);
}
```

## 8. Repository Pattern Standard
```csharp
public interface IEmployeeRepository
{
    Task<Employee?> GetByIdAsync(int employeeId);
    Task<List<Employee>> GetAllAsync();
}
```

## 9. Controller Standard
```csharp
[ApiController]
[Route("api/[controller]")]
public class EmployeeController : ControllerBase
{
    private readonly IEmployeeService _service;
}
```

## 10. Naming Conventions
| Type | Convention |
|------|------------|
| Entity | Employee |
| Request | CreateEmployeeRequest |
| Response | EmployeeResponse |
| Service | EmployeeService |
| Interface | IEmployeeService |
| Repository | EmployeeRepository |
| Controller | EmployeeController |

## 11. Validation Standard
Use FluentValidation.
```csharp
public class CreateEmployeeValidator : AbstractValidator<CreateEmployeeRequest>
{
    public CreateEmployeeValidator()
    {
        RuleFor(x => x.EmployeeCode).NotEmpty();
        RuleFor(x => x.Email).EmailAddress();
    }
}
```

## 12. Exception Handling
Use global exception middleware:
```csharp
app.UseMiddleware<ExceptionMiddleware>();
```

## 13. Logging Standard
- Serilog, ILogger, Application Insights
- Never log passwords, tokens, or sensitive user data.

## 14. Dependency Injection
```csharp
builder.Services.AddScoped<IEmployeeService, EmployeeService>();
builder.Services.AddScoped<IEmployeeRepository, EmployeeRepository>();
```

## 15. Enterprise Folder Structure per Feature
```
Employee
├── Requests
│   ├── CreateEmployeeRequest.cs
│   ├── UpdateEmployeeRequest.cs
│   └── EmployeeSearchRequest.cs
├── Responses
│   ├── EmployeeResponse.cs
│   ├── EmployeeDetailsResponse.cs
│   └── EmployeeListResponse.cs
├── Validators
├── Services
└── Repositories
```

## 16. Recommended Technologies
| Area | Technology |
|------|------------|
| Framework | ASP.NET Core |
| ORM | Entity Framework Core |
| Validation | FluentValidation |
| Mapping | AutoMapper |
| Logging | Serilog |
| Authentication | JWT |
| Documentation | Swagger/OpenAPI |
| Unit Testing | xUnit |
| Mocking | Moq |
| Database | SQL Server |
| Caching | Redis |
| Background Jobs | Hangfire |

## 17. Summary Rules
1. Keep Controllers Thin
2. Put Business Logic in Services
3. Put Data Access in Repositories
4. Separate Request and Response DTOs
5. Use Standard API Response Wrappers (`ApiResponse<T>`)
6. Use FluentValidation for all Requests
7. Use Global Exception Handling Middleware
8. Follow Consistent Naming Conventions
9. Maintain Layered Architecture
10. Write Unit and Integration Tests
