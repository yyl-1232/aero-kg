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
import { useState } from 'react';
import { useFormContext } from 'react-hook-form';

export function KgSelector() {
  const form = useFormContext();
  const [open, setOpen] = useState(false);
  const { knowledgeGraphs, loading } = useFetchKnowledgeGraphList();

  // 直接使用表单值，不维护本地状态
  const selectedValues = form.watch('prompt_config.kg_ids') || [];

  const kgOptions = knowledgeGraphs.map((kg: IKnowledgeGraph) => ({
    label: kg.name,
    value: kg.id,
    description: kg.description,
    icon: () => (
      <RAGFlowAvatar
        className="size-4 mr-2"
        avatar={kg.avatar}
        name={kg.name}
      />
    ),
  }));

  // 其他函数直接操作表单值
  const toggleOption = (option: string) => {
    // 修复：使用 getValues() 替代 getFieldValue()
    const currentValues = form.getValues('prompt_config.kg_ids') || [];
    const newSelectedValues = currentValues.includes(option)
      ? currentValues.filter((value) => value !== option)
      : [...currentValues, option];
    form.setValue('prompt_config.kg_ids', newSelectedValues);
  };

  const handleTogglePopover = () => {
    setOpen((prev) => !prev);
  };

  const handleClear = () => {
    // 修复：直接使用 form.setValue() 而不是不存在的 setSelectedValues
    form.setValue('prompt_config.kg_ids', []);
  };

  const toggleAll = () => {
    if (selectedValues.length === kgOptions.length) {
      handleClear();
    } else {
      const allValues = kgOptions.map((option) => option.value);
      // 修复：直接使用 form.setValue() 而不是不存在的 setSelectedValues
      form.setValue('prompt_config.kg_ids', allValues);
    }
  };

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      setOpen(true);
    } else if (event.key === 'Backspace' && !event.currentTarget.value) {
      // 修复：使用 getValues() 获取当前值
      const currentValues = form.getValues('prompt_config.kg_ids') || [];
      const newSelectedValues = [...currentValues];
      newSelectedValues.pop();
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
                    {selectedValues.length > 0 ? (
                      <div className="flex justify-between items-center w-full">
                        <div className="flex flex-wrap items-center">
                          {selectedValues?.slice(0, 3)?.map((value) => {
                            const option = kgOptions.find(
                              (o) => o.value === value,
                            );
                            const IconComponent = option?.icon;
                            return (
                              <div
                                key={value}
                                className="flex items-center gap-1 px-2 py-1 bg-secondary rounded-sm mr-2 mb-1"
                              >
                                {IconComponent && <IconComponent />}
                                <span className="text-sm">{option?.label}</span>
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
                              +{selectedValues.length - 3} 更多
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
                          请选择知识图谱
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
