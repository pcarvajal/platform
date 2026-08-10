export interface HasId<TId extends string = string> {
  id: { value: TId };
}

/**
 * Generalizes the `Map`-backed repository every project ends up hand-writing for tests (and for
 * `deployment/local`) — see the `InMemoryTicketRepository` in the root README's end-to-end
 * example. Extend it for a project's own entity instead of rewriting `save`/`findById`/`findAll`
 * with a `Map<string, T>` each time.
 */
export abstract class InMemoryRepository<TId extends string, TEntity extends HasId<TId>> {
  protected readonly items = new Map<TId, TEntity>();

  async save(entity: TEntity): Promise<void> {
    this.items.set(entity.id.value, entity);
  }

  async findById(id: TId): Promise<TEntity | undefined> {
    return this.items.get(id);
  }

  async findAll(): Promise<TEntity[]> {
    return [...this.items.values()];
  }

  async delete(id: TId): Promise<void> {
    this.items.delete(id);
  }
}
