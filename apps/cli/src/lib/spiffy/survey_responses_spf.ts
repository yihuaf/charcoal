import { z } from 'zod';
import { spiffy } from './spiffy';

const surveyConfigSchema = z.object({
  responses: z
    .object({
      timestamp: z.number(),
      responses: z.array(
        z.object({
          question: z.string(),
          answer: z.string(),
        })
      ),
      exitedEarly: z.boolean(),
    })
    .optional(),
  postingResponse: z.boolean(),
});

export type TSurveyResponse = NonNullable<
  z.infer<typeof surveyConfigSchema>['responses']
>;

export const surveyConfigFactory = spiffy({
  schema: surveyConfigSchema,
  defaultLocations: [
    {
      relativePath: '.graphite_beta_survey',
      relativeTo: 'USER_HOME',
    },
  ],
  initialize: () => {
    return {
      responses: undefined,
      postingResponse: false,
    };
  },
  helperFunctions: (data, update) => {
    return {
      setSurveyResponses: (responses: TSurveyResponse): void => {
        update((data) => (data.responses = responses));
      },
      hasSurveyResponse: (): boolean => data.responses !== undefined,
      clearPriorSurveyResponses: (): void => {
        update((data) => (data.responses = undefined));
      },
    };
  },
});

export type TSurveyConfig = ReturnType<typeof surveyConfigFactory.load>;
