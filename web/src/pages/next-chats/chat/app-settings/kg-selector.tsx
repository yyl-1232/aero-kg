import { RAGFlowAvatar } from '@/components/ragflow-avatar';
import { SliderInputFormField } from '@/components/slider-input-form-field';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  IKnowledgeGraph,
  useFetchKnowledgeGraphList,
} from '@/hooks/use-knowledge-graph-request';
import { cn } from '@/lib/utils';
import { CheckIcon, ChevronDown, XCircle, XIcon } from 'lucide-react';
import { type KeyboardEvent, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

export function KgSelector() {
  const form = useFormContext();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { knowledgeGraphs, loading } = useFetchKnowledgeGraphList();

  const kgOptions = knowledgeGraphs.map((kg: IKnowledgeGraph) => ({
    label: kg.name,
    value: kg.id,
    icon: () => <RAGFlowAvatar className="size-4 mr-2" name={kg.name} />,
  }));

  const updateSelectedValues = (values: string[]) => {
    form.setValue('prompt_config.kg_ids', values, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  };

  const toggleOption = (option: string) => {
    const currentValues = form.getValues('prompt_config.kg_ids') || [];
    const newSelectedValues = currentValues.includes(option)
      ? currentValues.filter((value: string) => value !== option)
      : [...currentValues, option];

    updateSelectedValues(newSelectedValues);
  };

  const handleClear = () => {
    updateSelectedValues([]);
  };

  const toggleAll = (selectedValues: string[]) => {
    if (selectedValues.length === kgOptions.length) {
      handleClear();
      return;
    }

    updateSelectedValues(kgOptions.map((option) => option.value));
  };

  const handleInputKeyDown = (
    event: KeyboardEvent<HTMLInputElement>,
    selectedValues: string[],
  ) => {
    if (event.key === 'Enter') {
      setOpen(true);
      return;
    }

    if (event.key === 'Backspace' && !event.currentTarget.value) {
      updateSelectedValues(selectedValues.slice(0, -1));
    }
  };

  return (
    <div className="space-y-4">
      <FormField
        control={form.control}
        name="prompt_config.kg_ids"
        render={({ field }) => {
          const selectedValues = field.value ?? [];

          return (
            <FormItem>
              <FormLabel>{t('knowledgeDetails.knowledgeGraph')}</FormLabel>
              <FormControl>
                <Popover open={open} onOpenChange={setOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setOpen((prev) => !prev)}
                      className={cn(
                        'flex w-full p-1 rounded-md text-base text-text-primary border border-input min-h-10 h-auto items-center justify-between bg-bg-input hover:bg-bg-input [&_svg]:pointer-events-auto',
                      )}
                    >
                      {selectedValues.length > 0 ? (
                        <div className="flex justify-between items-center w-full">
                          <div className="flex flex-wrap items-center">
                            {selectedValues.slice(0, 3).map((value: string) => {
                              const option = kgOptions.find(
                                (item) => item.value === value,
                              );
                              const IconComponent = option?.icon;

                              return (
                                <div
                                  key={value}
                                  className="flex items-center gap-1 px-2 py-1 bg-secondary rounded-sm mr-2 mb-1"
                                >
                                  {IconComponent && <IconComponent />}
                                  <span className="text-sm">
                                    {option?.label ?? value}
                                  </span>
                                  <XCircle
                                    className="h-3 w-3 cursor-pointer ml-1"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      toggleOption(value);
                                    }}
                                  />
                                </div>
                              );
                            })}
                            {selectedValues.length > 3 && (
                              <span className="text-sm text-muted-foreground">
                                +{selectedValues.length - 3} more
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-between">
                            <XIcon
                              className="h-4 mx-2 cursor-pointer text-muted-foreground"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleClear();
                              }}
                            />
                            <ChevronDown className="h-4 mx-2 cursor-pointer text-muted-foreground" />
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between w-full">
                          <span className="text-sm text-muted-foreground mx-3">
                            {t('common.pleaseSelect')}
                          </span>
                          <ChevronDown className="h-4 cursor-pointer text-muted-foreground mx-2" />
                        </div>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-auto p-0"
                    align="start"
                    onEscapeKeyDown={() => setOpen(false)}
                  >
                    <Command>
                      <CommandInput
                        placeholder={t('common.search')}
                        onKeyDown={(event) =>
                          handleInputKeyDown(event, selectedValues)
                        }
                      />
                      <CommandList>
                        <CommandEmpty>
                          {loading ? 'Loading...' : t('common.noResults')}
                        </CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            key="all"
                            onSelect={() => toggleAll(selectedValues)}
                            className="cursor-pointer"
                          >
                            <div
                              className={cn(
                                'mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary',
                                selectedValues.length === kgOptions.length
                                  ? 'bg-primary text-primary-foreground'
                                  : 'opacity-50 [&_svg]:invisible',
                              )}
                            >
                              <CheckIcon className="h-4 w-4" />
                            </div>
                            <span>(Select All)</span>
                          </CommandItem>
                          {kgOptions.map((option) => {
                            const isSelected = selectedValues.includes(
                              option.value,
                            );

                            return (
                              <CommandItem
                                key={option.value}
                                onSelect={() => toggleOption(option.value)}
                                className="cursor-pointer"
                              >
                                <div
                                  className={cn(
                                    'mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary',
                                    isSelected
                                      ? 'bg-primary'
                                      : 'opacity-50 [&_svg]:invisible',
                                  )}
                                >
                                  <CheckIcon className="h-4 w-4" />
                                </div>
                                {option.icon && <option.icon />}
                                <span>{option.label}</span>
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                        <CommandSeparator />
                        <CommandGroup>
                          <div className="flex items-center justify-between">
                            {selectedValues.length > 0 && (
                              <CommandItem
                                onSelect={handleClear}
                                className="flex-1 justify-center cursor-pointer"
                              >
                                Clear
                              </CommandItem>
                            )}
                            <CommandItem
                              onSelect={() => setOpen(false)}
                              className="flex-1 justify-center cursor-pointer max-w-full"
                            >
                              Close
                            </CommandItem>
                          </div>
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </FormControl>
              <FormMessage />
            </FormItem>
          );
        }}
      />

      <SliderInputFormField
        name="prompt_config.kg_similarity_threshold"
        label={t('knowledgeDetails.similarityThreshold')}
        min={0}
        max={1}
        step={0.01}
        defaultValue={0.3}
      />

      <SliderInputFormField
        name="prompt_config.kg_mining_depth"
        label="探索深度"
        min={1}
        max={10}
        step={1}
        defaultValue={2}
      />
    </div>
  );
}
