import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  ScanCommand,
  type DynamoDBDocumentClient,
} from "@aws-sdk/lib-dynamodb";

export interface HasId<TId extends string = string> {
  id: { value: TId };
}

export type DynamoDbRepositoryConfig = {
  tableName: string;
  // Nombre del atributo de partition key en la tabla — "id" por defecto.
  partitionKey?: string;
};

/**
 * Base de repositorio DynamoDB de una tabla — misma forma (`save`/`findById`/`findAll`/`delete`)
 * que `InMemoryRepository` (`@platform/testing`), para que un repositorio real y uno de test sean
 * intercambiables sin cambiar el código que los consume. Requiere un `DynamoDBDocumentClient` ya
 * construido (no lo crea) y que la subclase declare cómo convertir entidad <-> item.
 *
 * `findAll` usa `Scan`: es una base mínima de referencia para el caso común, no un framework de
 * single-table design — para una tabla grande o con GSIs, sobreescribir `findAll` con una `Query`
 * en la subclase en vez de depender del scan.
 */
export abstract class DynamoDbRepository<TId extends string, TEntity extends HasId<TId>> {
  private readonly partitionKey: string;

  constructor(
    protected readonly client: DynamoDBDocumentClient,
    protected readonly config: DynamoDbRepositoryConfig,
  ) {
    this.partitionKey = config.partitionKey ?? "id";
  }

  protected abstract toItem(entity: TEntity): Record<string, unknown>;
  protected abstract fromItem(item: Record<string, unknown>): TEntity;

  async save(entity: TEntity): Promise<void> {
    await this.client.send(
      new PutCommand({ TableName: this.config.tableName, Item: this.toItem(entity) }),
    );
  }

  async findById(id: TId): Promise<TEntity | undefined> {
    const result = await this.client.send(
      new GetCommand({ TableName: this.config.tableName, Key: { [this.partitionKey]: id } }),
    );
    return result.Item ? this.fromItem(result.Item) : undefined;
  }

  async findAll(): Promise<TEntity[]> {
    const result = await this.client.send(new ScanCommand({ TableName: this.config.tableName }));
    return (result.Items ?? []).map((item) => this.fromItem(item));
  }

  async delete(id: TId): Promise<void> {
    await this.client.send(
      new DeleteCommand({ TableName: this.config.tableName, Key: { [this.partitionKey]: id } }),
    );
  }
}
