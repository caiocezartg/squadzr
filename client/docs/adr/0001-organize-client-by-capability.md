---
status: accepted
---

# Organize client modules by product capability

Client code is organized incrementally around product capabilities such as the room catalog, room creation, joining, and the live lobby. TanStack route files remain thin entry points, generic UI and transport infrastructure remain shared, and each capability exposes a small public interface while keeping queries, mutations, cache behavior, and presentation details internal. The migration proceeds one capability at a time, starting with the live lobby.
