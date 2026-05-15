import crypto from 'node:crypto';
import { Session } from '../../models/Session.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const getMaxMessagesPerSession = () => {
  const parsed = Number.parseInt(process.env.BOOKFRIEND_MAX_MESSAGES_PER_SESSION || '40', 10);
  return Number.isFinite(parsed) ? clamp(parsed, 10, 200) : 40;
};

export const createSession = async ({ userId, gutenbergId, ragEnabled }) => {
  const sessionId = crypto.randomUUID();
  const expiresAt = Session.buildExpiresAt();

  await Session.create({
    sessionId,
    userId: String(userId),
    gutenbergId: gutenbergId == null ? null : Number(gutenbergId),
    ragEnabled: Boolean(ragEnabled),
    messages: [],
    expiresAt,
  });

  return sessionId;
};

export const getSessionById = async (sessionId) => {
  if (!sessionId) return null;
  return Session.findOne({ sessionId: String(sessionId) }).lean();
};

export const touchSession = async (sessionId) => {
  if (!sessionId) return false;
  const expiresAt = Session.buildExpiresAt();
  const updated = await Session.updateOne({ sessionId: String(sessionId) }, { $set: { expiresAt } });
  return updated.modifiedCount > 0;
};

// export const appendMessage = async ({ sessionId, role, content }) => {
//   const maxMessages = getMaxMessagesPerSession();
//   const now = new Date();
//   const expiresAt = Session.buildExpiresAt();

//   // Push new message, refresh TTL, and cap message list in one go.
//   const result = await Session.updateOne(
//     { sessionId: String(sessionId) },
//     [
//       {
//         $set: {
//           expiresAt,
//           messages: {
//             $concatArrays: [
//               '$messages',
//               [{ role, content: String(content), timestamp: now }],
//             ],
//           },
//         },
//       },
//       {
//         $set: {
//           messages: {
//             $slice: ['$messages', -maxMessages],
//           },
//         },
//       },
//     ],
//   );
  

//   return result.modifiedCount > 0;
// };
export const appendMessage = async ({ sessionId, role, content }) => {
  const maxMessages = getMaxMessagesPerSession();
  const now = new Date();
  const expiresAt = Session.buildExpiresAt();

  const result = await Session.findOneAndUpdate(
    { sessionId: String(sessionId) },
    {
      $push: {
        messages: {
          $each: [
            {
              role,
              content: String(content),
              timestamp: now,
            },
          ],
          $slice: -maxMessages,
        },
      },
      $set: {
        expiresAt,
      },
    },
    {
      returnDocument: 'after',
    },
  );

  return !!result;
};

export const endSession = async (sessionId) => {
  const result = await Session.deleteOne({ sessionId: String(sessionId) });
  return result.deletedCount > 0;
};

