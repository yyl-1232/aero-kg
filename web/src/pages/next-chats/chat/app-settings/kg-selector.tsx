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
import { CheckIcon } from 'lucide-react';
import { useState } from 'react';
import { useFormContext } from 'react-hook-form';

export function KgSelector() {
  const form = useFormContext();
  const [open, setOpen] = useState(false);
  const { knowledgeGraphs, loading } = useFetchKnowledgeGraphList();

  const selectedKgIds = form.watch('prompt_config.kg_ids') || [];
  const [selectedValues, setSelectedValues] = useState<string[]>(selectedKgIds);

  const kgOptions = knowledgeGraphs.map((kg: IKnowledgeGraph) => ({
    label: kg.name,
    value: kg.id,
    description: kg.description,
  }));

  const handleTogglePopover = () => {
    setOpen((prev) => !prev);
  };

  const handleClear = () => {
    setSelectedValues([]);
    form.setValue('prompt_config.kg_ids', []);
  };

  const toggleOption = (option: string) => {
    const newSelectedValues = selectedValues.includes(option)
      ? selectedValues.filter((value) => value !== option)
      : [...selectedValues, option];
    setSelectedValues(newSelectedValues);
    form.setValue('prompt_config.kg_ids', newSelectedValues);
  };

  const toggleAll = () => {
    if (selectedValues.length === kgOptions.length) {
      handleClear();
    } else {
      const allValues = kgOptions.map((option) => option.value);
      setSelectedValues(allValues);
      form.setValue('prompt_config.kg_ids', allValues);
    }
  };

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      setOpen(true);
    } else if (event.key === 'Backspace' && !event.currentTarget.value) {
      const newSelectedValues = [...selectedValues];
      newSelectedValues.pop();
      setSelectedValues(newSelectedValues);
      form.setValue('prompt_config.kg_ids', newSelectedValues);
    }
  };

  return (
    <div className="space-y-4">
      <FormField
        control={form.control}
        name="prompt_config.kg_ids"
        render={({ field }) => (
          <FormItem>
            <FormLabel>选择知识图谱</FormLabel>
            <FormControl>
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    onClick={handleTogglePopover}
                    className={cn(
                      'flex w-full p-1 rounded-md text-base text-text-primary border min-h-10 h-auto items-center justify-between bg-inherit hover:bg-inherit [&_svg]:pointer-events-auto',
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          selectedValues.length === 0
                            ? 'text-muted-foreground text-sm'
                            : 'text-sm',
                        )}
                      >
                        {selectedValues.length > 0
                          ? `${selectedValues.length}/${kgOptions?.length ?? 0} 知识图谱`
                          : '请选择'}
                      </span>
                    </div>
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-auto p-0"
                  align="start"
                  onEscapeKeyDown={() => setOpen(false)}
                >
                  <Command>
                    <CommandInput
                      placeholder="Search..."
                      onKeyDown={handleInputKeyDown}
                    />
                    <CommandList>
                      <CommandEmpty>未找到知识图谱</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          key="all"
                          onSelect={toggleAll}
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
                              className={cn('cursor-pointer')}
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
                              <span>{option.label}</span>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                      <CommandSeparator />
                      <CommandGroup>
                        <div className="flex items-center justify-between">
                          {selectedValues.length > 0 && (
                            <>
                              <CommandItem
                                onSelect={handleClear}
                                className="flex-1 justify-center cursor-pointer"
                              >
                                清除
                              </CommandItem>
                              <CommandSeparator
                                orientation="vertical"
                                className="flex min-h-6 h-full"
                              />
                            </>
                          )}
                          <CommandItem
                            onSelect={() => setOpen(false)}
                            className="flex-1 justify-center cursor-pointer max-w-full"
                          >
                            关闭
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
        )}
      />

      <SliderInputFormField
        name="prompt_config.kg_similarity_threshold"
        label="相似度阈值"
        min={0}
        max={1}
        step={0.01}
        defaultValue={0.3}
      />

      <SliderInputFormField
        name="prompt_config.kg_mining_depth"
        label="挖掘深度"
        min={1}
        max={10}
        step={1}
        defaultValue={2}
      />
    </div>
  );
}
