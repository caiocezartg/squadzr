import type { IGameRepository } from '@domain/repositories/game.repository'

/** Delegates every call to `inner`, except the relist, which fails after the delist. */
export function failAtRelist(inner: IGameRepository): IGameRepository {
  return {
    findById: (id) => inner.findById(id),
    findAll: () => inner.findAll(),
    search: (input) => inner.search(input),
    findPopular: (input) => inner.findPopular(input),
    countListed: () => inner.countListed(),
    upsertByIgdbId: (input) => inner.upsertByIgdbId(input),
    delistByIgdbIds: (igdbIds) => inner.delistByIgdbIds(igdbIds),
    relistByIgdbIds: () => Promise.reject(new Error('relist failed after delist')),
    acquireCatalogImportLock: () => inner.acquireCatalogImportLock(),
    runInTransaction: (work) => inner.runInTransaction((tx) => work(failAtRelist(tx))),
  }
}
