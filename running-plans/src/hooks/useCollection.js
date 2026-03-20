import { useEffect, useState } from 'react'
import {
  collection,
  onSnapshot,
  query,
  orderBy,
} from 'firebase/firestore'
import { db } from '../firebase/config'

/**
 * Subscribes to a Firestore collection and returns its documents as an array.
 * Each document includes its Firestore ID as `id`.
 */
export function useCollection(collectionName, orderField = 'createdAt') {
  const [docs,  setDocs]  = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    const q = query(
      collection(db, collectionName),
      orderBy(orderField, 'desc'),
    )
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const results = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        setDocs(results)
        setError(null)
      },
      (err) => {
        console.error('useCollection error:', err)
        setError(err.message)
      },
    )
    return unsubscribe
  }, [collectionName, orderField])

  return { docs, error }
}
